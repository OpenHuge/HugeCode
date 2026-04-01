import type { RuntimeBrowserReadinessSummary } from "../../../application/runtime/ports/browserCapability";
import type { RuntimeBrowserAssessmentOperatorState } from "../../../application/runtime/facades/runtimeBrowserAssessmentOperator";
import type { RuntimeBrowserExtractionOperatorState } from "../../../application/runtime/facades/runtimeBrowserExtractionOperator";
import { ToolCallChip } from "../../../design-system";
import { MissionControlSectionCard } from "./WorkspaceHomeMissionControlSections";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

type WorkspaceHomeAgentRuntimeBrowserSectionProps = {
  browserAssessment: RuntimeBrowserAssessmentOperatorState;
  browserExtraction: RuntimeBrowserExtractionOperatorState;
  browserReadiness: RuntimeBrowserReadinessSummary;
  browserReadinessStatusLabel: "Attention" | "Blocked" | "Ready";
  browserReadinessStatusTone: "danger" | "success" | "warning";
};

export function WorkspaceHomeAgentRuntimeBrowserSection(
  props: WorkspaceHomeAgentRuntimeBrowserSectionProps
) {
  const {
    browserAssessment,
    browserExtraction,
    browserReadiness,
    browserReadinessStatusLabel,
    browserReadinessStatusTone,
  } = props;
  const browserAssessmentResult = browserAssessment.result;
  const browserAssessmentPresentation = browserAssessment.resultPresentation;
  const browserExtractionResult = browserExtraction.result;
  const browserExtractionPresentation = browserExtraction.resultPresentation;

  return (
    <MissionControlSectionCard
      title="Browser readiness"
      statusLabel={browserReadinessStatusLabel}
      statusTone={browserReadinessStatusTone}
      meta={
        <>
          <ToolCallChip tone="neutral">Host {browserReadiness.runtimeHost}</ToolCallChip>
          <ToolCallChip
            tone={
              browserReadiness.assessmentAvailable || browserReadiness.extractionAvailable
                ? "success"
                : browserReadiness.localOnly
                  ? "warning"
                  : "neutral"
            }
          >
            Browser loop{" "}
            {browserReadiness.assessmentAvailable || browserReadiness.extractionAvailable
              ? "published"
              : "unavailable"}
          </ToolCallChip>
          <ToolCallChip tone="neutral">Source {browserReadiness.sourceLabel}</ToolCallChip>
        </>
      }
    >
      <div
        className="workspace-home-code-runtime-item"
        data-testid="workspace-runtime-browser-readiness"
      >
        <div className="workspace-home-code-runtime-item-main">
          <strong>{browserReadiness.headline}</strong>
          <span>{browserReadiness.detail}</span>
          <span>{browserReadiness.recommendedAction}</span>
          <span>
            Capability boundary: separate from Governance / Policy and sourced from browser host
            capability truth.
          </span>
          <span>
            Signals: assessment {browserReadiness.capabilities.browserAssessment ? "yes" : "no"} |
            assessment history{" "}
            {browserReadiness.capabilities.browserAssessmentHistory ? "yes" : "no"} | extraction{" "}
            {browserReadiness.capabilities.browserExtraction ? "yes" : "no"} | history{" "}
            {browserReadiness.capabilities.browserExtractionHistory ? "yes" : "no"} | debug{" "}
            {browserReadiness.capabilities.browserDebug ? "yes" : "no"} | WebMCP{" "}
            {browserReadiness.capabilities.webMcp ? "yes" : "no"}
          </span>
          <span>
            Placeholder-only: {browserReadiness.localOnly ? "yes" : "no"} | runtime host:{" "}
            {browserReadiness.runtimeHost}
          </span>
          {browserReadiness.lastAssessmentResult ? (
            <span>
              Last assessment: {browserReadiness.lastAssessmentResult.status}
              {browserReadiness.lastAssessmentResult.errorCode
                ? ` (${browserReadiness.lastAssessmentResult.errorCode})`
                : ""}
            </span>
          ) : null}
          {browserReadiness.lastResult ? (
            <span>
              Last result: {browserReadiness.lastResult.status}
              {browserReadiness.lastResult.errorCode
                ? ` (${browserReadiness.lastResult.errorCode})`
                : ""}
            </span>
          ) : null}
        </div>
      </div>
      <div
        className="workspace-home-code-runtime-item"
        data-testid="workspace-runtime-browser-assessment-operator"
      >
        <div className="workspace-home-code-runtime-item-main">
          <strong>Browser assessment operator</strong>
          <span>
            Run the canonical localized render loop through the Electron bridge browser capability
            facade and feed DOM, console, and accessibility findings back into the runtime.
          </span>
          <span>
            Assessment now: {browserAssessment.canAssess ? "available" : "blocked"} | Review last
            result: {browserAssessment.canReviewLastResult ? "available" : "blocked"}
          </span>
        </div>
        <div className={controlStyles.controlGrid}>
          <label className={controlStyles.field}>
            <span>Target kind</span>
            <select
              className={controlStyles.fieldControl}
              value={browserAssessment.input.targetKind}
              onChange={(event) =>
                browserAssessment.setTargetKind(
                  event.target.value === "route" ? "route" : "fixture"
                )
              }
            >
              <option value="fixture">Fixture</option>
              <option value="route">Route</option>
            </select>
          </label>
          <label className={controlStyles.field}>
            <span>Fixture or route</span>
            <input
              className={controlStyles.fieldControl}
              type="text"
              value={browserAssessment.input.targetValue}
              onChange={(event) => browserAssessment.setTargetValue(event.target.value)}
              placeholder={
                browserAssessment.input.targetKind === "fixture"
                  ? "mission-control"
                  : "/workspace/alpha"
              }
            />
          </label>
          <label className={controlStyles.field}>
            <span>Selector</span>
            <input
              className={controlStyles.fieldControl}
              type="text"
              value={browserAssessment.input.selector}
              onChange={(event) => browserAssessment.setSelector(event.target.value)}
              placeholder="Optional: assess a specific element"
            />
          </label>
        </div>
        <div className={controlStyles.actions}>
          <button
            className={controlStyles.actionButton}
            type="button"
            onClick={() => void browserAssessment.assess()}
            disabled={
              !browserAssessment.canAssess ||
              browserAssessment.loading ||
              Boolean(browserAssessment.assessDisabledReason)
            }
            title={browserAssessment.assessDisabledReason ?? undefined}
          >
            {browserAssessment.runningAssessment ? "Assessing..." : "Assess browser surface"}
          </button>
          <button
            className={controlStyles.actionButton}
            type="button"
            onClick={() => void browserAssessment.reviewLastResult()}
            disabled={!browserAssessment.canReviewLastResult || browserAssessment.loading}
            title={browserAssessment.reviewLastResultDisabledReason ?? undefined}
          >
            {browserAssessment.reviewingLastResult ? "Loading..." : "Review last assessment"}
          </button>
        </div>
        {browserAssessment.assessDisabledReason && !browserAssessment.canAssess ? (
          <div className={controlStyles.sectionMeta}>
            Assessment blocked: {browserAssessment.assessDisabledReason}
          </div>
        ) : null}
        {browserAssessment.notice ? (
          <div
            className={
              browserAssessment.notice.tone === "danger"
                ? controlStyles.error
                : browserAssessment.notice.tone === "warning"
                  ? controlStyles.warning
                  : controlStyles.emptyState
            }
          >
            {browserAssessment.notice.message}
          </div>
        ) : null}
        {browserAssessmentResult && browserAssessmentPresentation ? (
          <div
            className="workspace-home-code-runtime-item"
            data-testid="workspace-runtime-browser-assessment-result"
          >
            <div className="workspace-home-code-runtime-item-main">
              <strong>{browserAssessmentPresentation.headline}</strong>
              <span>
                <ToolCallChip tone={browserAssessmentPresentation.statusTone}>
                  {browserAssessmentPresentation.statusLabel}
                </ToolCallChip>
                {browserAssessment.resultSourceLabel ? (
                  <ToolCallChip tone="neutral">{browserAssessment.resultSourceLabel}</ToolCallChip>
                ) : null}
              </span>
              <span>{browserAssessmentPresentation.detail}</span>
              <span>
                Target:{" "}
                {browserAssessmentResult.target.kind === "fixture"
                  ? browserAssessmentResult.target.fixtureName
                  : browserAssessmentResult.target.routePath}
              </span>
              {browserAssessmentResult.sourceUrl ? (
                <span>Surface URL: {browserAssessmentResult.sourceUrl}</span>
              ) : null}
              {browserAssessmentResult.errorCode ? (
                <span>Error code: {browserAssessmentResult.errorCode}</span>
              ) : null}
              <span>
                Accessibility failures: {browserAssessmentResult.accessibilityFailures.length} |
                console entries: {browserAssessmentResult.consoleEntries.length}
              </span>
              {browserAssessmentPresentation.traceSummary ? (
                <span>Trace: {browserAssessmentPresentation.traceSummary}</span>
              ) : null}
              {browserAssessmentResult.domSnapshot?.text ? (
                <div className={controlStyles.extractionPreview}>
                  {browserAssessmentResult.domSnapshot.text}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className={controlStyles.emptyState}>
            No browser assessment result loaded yet. Run an assessment now or review the last
            recorded host result.
          </div>
        )}
      </div>
      <div
        className="workspace-home-code-runtime-item"
        data-testid="workspace-runtime-browser-extraction-operator"
      >
        <div className="workspace-home-code-runtime-item-main">
          <strong>Browser extraction operator</strong>
          <span>
            Trigger the canonical Electron bridge extraction contract from Mission Control and keep
            the latest host-published result available for review.
          </span>
          <span>
            Operator path: extract and history reads stay inside the approved application/runtime
            browser capability boundary.
          </span>
          <span>
            Extract now: {browserExtraction.canExtract ? "available" : "blocked"} | Review last
            result: {browserExtraction.canReviewLastResult ? "available" : "blocked"}
          </span>
        </div>
        <div className={controlStyles.controlGrid}>
          <label className={controlStyles.field}>
            <span>Preferred page URL</span>
            <input
              className={controlStyles.fieldControl}
              type="text"
              value={browserExtraction.input.sourceUrl}
              onChange={(event) => browserExtraction.setSourceUrl(event.target.value)}
              placeholder="Optional: target a specific local browser page"
            />
          </label>
          <label className={controlStyles.field}>
            <span>Selector</span>
            <input
              className={controlStyles.fieldControl}
              type="text"
              value={browserExtraction.input.selector}
              onChange={(event) => browserExtraction.setSelector(event.target.value)}
              placeholder="Optional: extract from a specific element"
            />
          </label>
        </div>
        <div className={controlStyles.actions}>
          <button
            className={controlStyles.actionButton}
            type="button"
            onClick={() => void browserExtraction.extract()}
            disabled={!browserExtraction.canExtract || browserExtraction.loading}
            title={browserExtraction.extractDisabledReason ?? undefined}
          >
            {browserExtraction.extracting ? "Extracting..." : "Extract browser page"}
          </button>
          <button
            className={controlStyles.actionButton}
            type="button"
            onClick={() => void browserExtraction.reviewLastResult()}
            disabled={!browserExtraction.canReviewLastResult || browserExtraction.loading}
            title={browserExtraction.reviewLastResultDisabledReason ?? undefined}
          >
            {browserExtraction.reviewingLastResult ? "Loading..." : "Review last result"}
          </button>
        </div>
        {browserExtraction.extractDisabledReason && !browserExtraction.canExtract ? (
          <div className={controlStyles.sectionMeta}>
            Extraction blocked: {browserExtraction.extractDisabledReason}
          </div>
        ) : null}
        {browserExtraction.notice ? (
          <div
            className={
              browserExtraction.notice.tone === "danger"
                ? controlStyles.error
                : browserExtraction.notice.tone === "warning"
                  ? controlStyles.warning
                  : controlStyles.emptyState
            }
          >
            {browserExtraction.notice.message}
          </div>
        ) : null}
        {browserExtractionResult && browserExtractionPresentation ? (
          <div
            className="workspace-home-code-runtime-item"
            data-testid="workspace-runtime-browser-extraction-result"
          >
            <div className="workspace-home-code-runtime-item-main">
              <strong>{browserExtractionPresentation.headline}</strong>
              <span>
                <ToolCallChip tone={browserExtractionPresentation.statusTone}>
                  {browserExtractionPresentation.statusLabel}
                </ToolCallChip>
                {browserExtraction.resultSourceLabel ? (
                  <ToolCallChip tone="neutral">{browserExtraction.resultSourceLabel}</ToolCallChip>
                ) : null}
              </span>
              <span>{browserExtractionPresentation.detail}</span>
              {browserExtractionResult.sourceUrl ? (
                <span>Page URL: {browserExtractionResult.sourceUrl}</span>
              ) : null}
              {browserExtractionResult.title ? (
                <span>Page title: {browserExtractionResult.title}</span>
              ) : null}
              {browserExtractionResult.errorCode ? (
                <span>Error code: {browserExtractionResult.errorCode}</span>
              ) : null}
              {browserExtractionPresentation.recommendedAction ? (
                <span>{browserExtractionPresentation.recommendedAction}</span>
              ) : null}
              {browserExtractionPresentation.traceSummary ? (
                <span>Trace: {browserExtractionPresentation.traceSummary}</span>
              ) : null}
              {browserExtractionResult.normalizedText ? (
                <div className={controlStyles.extractionPreview}>
                  {browserExtractionResult.normalizedText}
                </div>
              ) : null}
            </div>
            {browserExtractionPresentation.noDebugTargetDetail ? (
              <div className={controlStyles.warning}>
                {browserExtractionPresentation.noDebugTargetDetail}
              </div>
            ) : null}
          </div>
        ) : (
          <div className={controlStyles.emptyState}>
            No browser extraction result loaded yet. Run extraction now or review the last recorded
            host result.
          </div>
        )}
      </div>
    </MissionControlSectionCard>
  );
}

import { useState } from "react";
import {
  type ExecutionAction,
  formatExecutionDuration,
  formatExecutionTime,
  getActionLabel,
} from "./WorkspaceHomeAgentWebMcpConsoleSection.helpers";
import Clock3 from "lucide-react/dist/esm/icons/clock-3";
import Wrench from "lucide-react/dist/esm/icons/wrench";
import type {
  HydratedRuntimeOperatorTranscriptItem,
  RuntimeOperatorTranscriptAuditSnapshot,
  RuntimeOperatorTranscriptStatus,
  WebMcpCallerContextSource,
} from "../../../application/runtime/facades/runtimeOperatorTranscript";
import { Button } from "../../../design-system";
import { ActivityLogRow } from "../../../design-system";
import { ExecutionStatusPill } from "../../../design-system";
import { ToolCallChip } from "../../../design-system";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

export type WebMcpHistoryActionFilter = "all" | ExecutionAction;
export type WebMcpHistoryStatusFilter = "all" | RuntimeOperatorTranscriptStatus;
export type WebMcpHistoryCallerSourceFilter = "all" | WebMcpCallerContextSource;
export type WebMcpHistoryCallerProviderFilter = "all" | "n/a" | string;

type WorkspaceHomeAgentWebMcpConsoleHistorySectionProps = {
  executionHistory: HydratedRuntimeOperatorTranscriptItem[];
  filteredExecutionHistory: HydratedRuntimeOperatorTranscriptItem[];
  historyActionFilter: WebMcpHistoryActionFilter;
  historyStatusFilter: WebMcpHistoryStatusFilter;
  historyCallerSourceFilter: WebMcpHistoryCallerSourceFilter;
  historyCallerProviderFilter: WebMcpHistoryCallerProviderFilter;
  onHistoryActionFilterChange: (value: WebMcpHistoryActionFilter) => void;
  onHistoryStatusFilterChange: (value: WebMcpHistoryStatusFilter) => void;
  onHistoryCallerSourceFilterChange: (value: WebMcpHistoryCallerSourceFilter) => void;
  onHistoryCallerProviderFilterChange: (value: WebMcpHistoryCallerProviderFilter) => void;
  onLoadResult: (value: string) => void;
};

export function WorkspaceHomeAgentWebMcpConsoleHistorySection({
  executionHistory,
  filteredExecutionHistory,
  historyActionFilter,
  historyStatusFilter,
  historyCallerSourceFilter,
  historyCallerProviderFilter,
  onHistoryActionFilterChange,
  onHistoryStatusFilterChange,
  onHistoryCallerSourceFilterChange,
  onHistoryCallerProviderFilterChange,
  onLoadResult,
}: WorkspaceHomeAgentWebMcpConsoleHistorySectionProps) {
  const [copiedExecutionId, setCopiedExecutionId] = useState<string | null>(null);
  const [copyAuditError, setCopyAuditError] = useState<string | null>(null);
  const formatAuditValue = (value: string | null) => value ?? "n/a";
  const callerProviderOptions = Array.from(
    new Set(
      executionHistory
        .map((entry) => (entry.callerProviderFilter === "n/a" ? null : entry.callerProviderFilter))
        .filter((provider): provider is string => provider !== null)
    )
  ).sort((left, right) => left.localeCompare(right));
  const copyAuditSnapshot = async (entry: HydratedRuntimeOperatorTranscriptItem) => {
    const clipboardWriteText = globalThis.navigator?.clipboard?.writeText;
    if (typeof clipboardWriteText !== "function") {
      setCopyAuditError("Clipboard is unavailable in this environment.");
      setCopiedExecutionId(null);
      return;
    }
    const payload: RuntimeOperatorTranscriptAuditSnapshot = entry.auditSnapshot;
    await clipboardWriteText(JSON.stringify(payload, null, 2));
    setCopiedExecutionId(entry.id);
    setCopyAuditError(null);
  };

  return (
    <div className="workspace-home-webmcp-console-history">
      <div className={controlStyles.sectionHeader}>
        <div className={controlStyles.sectionTitle}>Recent Executions</div>
        <div className={controlStyles.sectionMeta}>
          {filteredExecutionHistory.length} / {executionHistory.length}
        </div>
      </div>
      <div className={controlStyles.actions}>
        <label className={controlStyles.field}>
          <span>Action</span>
          <select
            className={controlStyles.fieldControl}
            aria-label="History action filter"
            value={historyActionFilter}
            onChange={(event) =>
              onHistoryActionFilterChange(event.target.value as WebMcpHistoryActionFilter)
            }
          >
            <option value="all">All</option>
            <option value="tool">tool call</option>
            <option value="createMessage">createMessage</option>
            <option value="elicitInput">elicitInput</option>
          </select>
        </label>
        <label className={controlStyles.field}>
          <span>Status</span>
          <select
            className={controlStyles.fieldControl}
            aria-label="History status filter"
            value={historyStatusFilter}
            onChange={(event) =>
              onHistoryStatusFilterChange(event.target.value as WebMcpHistoryStatusFilter)
            }
          >
            <option value="all">All</option>
            <option value="success">success</option>
            <option value="error">error</option>
          </select>
        </label>
        <label className={controlStyles.field}>
          <span>Caller source</span>
          <select
            className={controlStyles.fieldControl}
            aria-label="History caller source filter"
            value={historyCallerSourceFilter}
            onChange={(event) =>
              onHistoryCallerSourceFilterChange(
                event.target.value as WebMcpHistoryCallerSourceFilter
              )
            }
          >
            <option value="all">All</option>
            <option value="runtime_metadata">runtime_metadata</option>
            <option value="request_context">request_context</option>
            <option value="request_input">request_input</option>
            <option value="unavailable">unavailable</option>
          </select>
        </label>
        <label className={controlStyles.field}>
          <span>Caller provider</span>
          <select
            className={controlStyles.fieldControl}
            aria-label="History caller provider filter"
            value={historyCallerProviderFilter}
            onChange={(event) =>
              onHistoryCallerProviderFilterChange(
                event.target.value as WebMcpHistoryCallerProviderFilter
              )
            }
          >
            <option value="all">All</option>
            <option value="n/a">n/a</option>
            {callerProviderOptions.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </label>
      </div>
      {executionHistory.length === 0 ? (
        <div className={controlStyles.emptyState}>No execution history yet.</div>
      ) : filteredExecutionHistory.length === 0 ? (
        <div className={controlStyles.emptyState}>No execution history for selected filters.</div>
      ) : (
        <div className="workspace-home-webmcp-console-history-list">
          {filteredExecutionHistory.map((entry) => (
            <ActivityLogRow
              key={entry.id}
              className="workspace-home-webmcp-console-history-item"
              tone={entry.status === "success" ? "success" : "danger"}
              icon={entry.action === "tool" ? <Wrench size={14} /> : <Clock3 size={14} />}
              title={entry.summary}
              description={`${getActionLabel(entry.action)} at ${formatExecutionTime(entry.at)}`}
              meta={
                <>
                  <ToolCallChip tone="neutral">{getActionLabel(entry.action)}</ToolCallChip>
                  <ExecutionStatusPill
                    tone={entry.status === "success" ? "success" : "danger"}
                    showDot
                  >
                    {entry.status}
                  </ExecutionStatusPill>
                  {entry.dryRun ? <ToolCallChip tone="warning">dry-run</ToolCallChip> : null}
                  <ToolCallChip tone="neutral">
                    {formatExecutionDuration(entry.durationMs)}
                  </ToolCallChip>
                  {entry.effectiveLimits ? (
                    <ToolCallChip tone="neutral">
                      limits payload&lt;={entry.effectiveLimits.payloadLimitBytes}B, observe&lt;=
                      {entry.effectiveLimits.computerObserveRateLimitPerMinute}/min
                    </ToolCallChip>
                  ) : null}
                </>
              }
              actions={
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onLoadResult(entry.result)}
                  >
                    Load
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void copyAuditSnapshot(entry);
                    }}
                    disabled={entry.action !== "tool"}
                  >
                    Copy audit
                  </Button>
                </>
              }
              body={
                entry.action === "tool" ? (
                  <div className="workspace-home-webmcp-console-history-context">
                    <div className="workspace-home-webmcp-console-history-context-row">
                      <ToolCallChip tone="neutral">
                        caller source: {entry.contextAudit.callerContext.source}
                      </ToolCallChip>
                      <ToolCallChip tone="neutral">
                        caller provider:{" "}
                        {formatAuditValue(entry.contextAudit.callerContext.provider)}
                      </ToolCallChip>
                      <ToolCallChip tone="neutral">
                        caller model: {formatAuditValue(entry.contextAudit.callerContext.modelId)}
                      </ToolCallChip>
                      {entry.contextAudit.callerContext.policySource ? (
                        <ToolCallChip tone="neutral">
                          policy: {entry.contextAudit.callerContext.policySource}
                        </ToolCallChip>
                      ) : null}
                    </div>
                    <div className="workspace-home-webmcp-console-history-context-row">
                      <ToolCallChip tone="neutral">
                        agent source: {entry.contextAudit.agentMetadata.source}
                      </ToolCallChip>
                      <ToolCallChip tone="neutral">
                        agent provider:{" "}
                        {formatAuditValue(entry.contextAudit.agentMetadata.provider)}
                      </ToolCallChip>
                      <ToolCallChip tone="neutral">
                        agent model: {formatAuditValue(entry.contextAudit.agentMetadata.modelId)}
                      </ToolCallChip>
                    </div>
                    {copiedExecutionId === entry.id ? (
                      <div className="workspace-home-webmcp-console-history-context-row">
                        <ToolCallChip tone="success">audit copied</ToolCallChip>
                      </div>
                    ) : null}
                    {copyAuditError && copiedExecutionId === null ? (
                      <div className="workspace-home-webmcp-console-history-context-row">
                        <ToolCallChip tone="danger">{copyAuditError}</ToolCallChip>
                      </div>
                    ) : null}
                  </div>
                ) : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

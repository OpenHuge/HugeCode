import type { ReactNode } from "react";
import { Badge, Button, StatusBadge, Text } from "../../design-system";
import { getDiffStatusBadgeTone, getDiffStatusLabel } from "../git/components/GitDiffPanel.utils";
import type {
  RightPanelDetailModel,
  RightPanelDiffFile,
  RightPanelInterruptModel,
} from "./rightPanelModels";
import {
  Chip,
  ChipList,
  CollapsibleSection,
  CopyableField,
  DetailHero,
  EvidenceList,
  EvidenceRow,
  InspectorSection,
  InspectorSectionBody,
  InspectorSectionHeader,
  NarrativeBlock,
  RightPanelEmptyState,
  StickySectionActions,
} from "./RightPanelPrimitives";
import * as styles from "./RightPanelPrimitives.css";

type SelectionActionsProps = {
  clearSelection: () => void;
  hasSelection: boolean;
};

function withoutMetric(
  metrics: Array<{ label: ReactNode; value: ReactNode }> | undefined,
  ...labels: string[]
) {
  if (!metrics || metrics.length === 0) {
    return undefined;
  }
  const hidden = new Set(labels);
  const filtered = metrics.filter((entry) => !hidden.has(String(entry.label)));
  return filtered.length > 0 ? filtered : undefined;
}

export function RightPanelInterruptView({ model }: { model: RightPanelInterruptModel | null }) {
  if (!model) {
    return null;
  }

  if (model.kind === "status") {
    return (
      <>
        <DetailHero
          eyebrow="Runtime state"
          title={model.title}
          subtitle={model.subtitle}
          actions={
            <StatusBadge tone={model.tone === "error" ? "error" : "warning"}>Blocking</StatusBadge>
          }
        />
        <NarrativeBlock>{model.description}</NarrativeBlock>
        <InspectorSection>
          <InspectorSectionHeader title="Context" subtitle="Current workspace state" />
          <InspectorSectionBody>
            <EvidenceList>
              {model.metadata.map((entry) => (
                <EvidenceRow key={entry.label} label={entry.label} value={entry.value} />
              ))}
            </EvidenceList>
          </InspectorSectionBody>
        </InspectorSection>
      </>
    );
  }

  if (model.kind === "approval") {
    return (
      <>
        <DetailHero
          eyebrow="Approval queue"
          title={model.title}
          subtitle={model.subtitle}
          actions={<StatusBadge tone="warning">Approval required</StatusBadge>}
        />
        <InspectorSection>
          <InspectorSectionHeader
            title="Approval detail"
            subtitle="Request parameters and intent"
          />
          <InspectorSectionBody>
            <EvidenceList>
              {model.entries.map((entry) => (
                <EvidenceRow
                  key={entry.label}
                  label={entry.label}
                  value={
                    entry.isCode ? (
                      <Text as="span" size="meta" tone="strong" monospace>
                        {entry.value}
                      </Text>
                    ) : (
                      entry.value
                    )
                  }
                />
              ))}
            </EvidenceList>
          </InspectorSectionBody>
        </InspectorSection>
      </>
    );
  }

  if (model.kind === "user-input") {
    return (
      <>
        <DetailHero
          eyebrow="Response required"
          title={model.title}
          subtitle={model.subtitle}
          actions={<StatusBadge tone="warning">Awaiting input</StatusBadge>}
        />
        <InspectorSection>
          <InspectorSectionHeader
            title="Questions"
            subtitle="Structured prompts the agent expects answered"
          />
          <InspectorSectionBody>
            <EvidenceList>
              {model.questions.map((question) => (
                <EvidenceRow
                  key={question.header}
                  label={question.header}
                  value={
                    <div className={styles.sectionBody}>
                      <span>{question.question}</span>
                      {question.options.length > 0 ? (
                        <ChipList>
                          {question.options.map((option) => (
                            <Chip key={option}>{option}</Chip>
                          ))}
                        </ChipList>
                      ) : null}
                    </div>
                  }
                />
              ))}
            </EvidenceList>
          </InspectorSectionBody>
        </InspectorSection>
      </>
    );
  }

  return (
    <>
      <DetailHero
        eyebrow="Tool gate"
        title={model.title}
        subtitle={model.subtitle}
        actions={<StatusBadge tone="warning">Pending call</StatusBadge>}
      />
      <CopyableField value={model.callId} label="Call ID" />
      <CollapsibleSection
        title="Arguments"
        subtitle="Structured payload queued for the next tool call"
        defaultOpen
      >
        <pre className={styles.preformattedBlock}>{model.detail}</pre>
      </CollapsibleSection>
    </>
  );
}

export function RightPanelDetailView({
  detailModel,
  hasSelection,
  clearSelection,
}: {
  detailModel: RightPanelDetailModel | null;
} & SelectionActionsProps) {
  if (!detailModel) {
    return (
      <RightPanelEmptyState
        title="Selection appears here"
        body="Select a step, file, diff, or review signal to inspect its evidence in place."
      />
    );
  }

  if (detailModel.kind === "status") {
    return (
      <>
        <DetailHero
          eyebrow="Selection status"
          title={detailModel.title}
          subtitle={detailModel.subtitle}
          actions={
            <StatusBadge tone={detailModel.tone === "error" ? "error" : "warning"}>
              {detailModel.tone === "error" ? "Error" : "Warning"}
            </StatusBadge>
          }
        />
        <NarrativeBlock>{detailModel.description}</NarrativeBlock>
        <InspectorSection>
          <InspectorSectionHeader
            title="Selection context"
            subtitle="State attached to the chosen runtime event"
          />
          <InspectorSectionBody>
            <EvidenceList>
              {detailModel.metadata.map((entry) => (
                <EvidenceRow key={entry.label} label={entry.label} value={entry.value} />
              ))}
            </EvidenceList>
          </InspectorSectionBody>
        </InspectorSection>
        <SelectionActions clearSelection={clearSelection} hasSelection={hasSelection} />
      </>
    );
  }

  if (detailModel.kind === "file") {
    return (
      <>
        <DetailHero
          eyebrow="File focus"
          title={detailModel.title}
          subtitle={detailModel.subtitle}
          actions={<StatusBadge tone="progress">{detailModel.fileStatus}</StatusBadge>}
        />
        <EvidenceList>
          {detailModel.metadata.map((entry) => (
            <EvidenceRow key={entry.label} label={entry.label} value={entry.value} />
          ))}
        </EvidenceList>
        <CopyableField value={detailModel.path} label="Path" />
        {detailModel.diff ? (
          <CollapsibleSection title="Patch" subtitle="Selected file diff" defaultOpen>
            <pre className={styles.preformattedBlock}>{detailModel.diff}</pre>
          </CollapsibleSection>
        ) : null}
        <SelectionActions clearSelection={clearSelection} hasSelection={hasSelection} />
      </>
    );
  }

  if (detailModel.kind === "diff") {
    return (
      <>
        <DetailHero
          eyebrow="Diff evidence"
          title={detailModel.title}
          subtitle={detailModel.subtitle}
          metrics={withoutMetric(detailModel.metrics, "Status")}
          actions={
            <StatusBadge tone={detailModel.status ? "progress" : "default"}>
              {detailModel.status ?? "Ready"}
            </StatusBadge>
          }
        />
        <DiffFileList files={detailModel.files} />
        <CollapsibleSection
          title="Patch body"
          subtitle="Raw diff context for the selected change set"
          defaultOpen={false}
        >
          <pre className={styles.preformattedBlock}>{detailModel.diff}</pre>
        </CollapsibleSection>
        <SelectionActions clearSelection={clearSelection} hasSelection={hasSelection} />
      </>
    );
  }

  if (detailModel.kind === "tool") {
    return (
      <>
        <DetailHero
          eyebrow="Tool execution"
          title={detailModel.title}
          subtitle={detailModel.subtitle}
          metrics={withoutMetric(detailModel.metrics, "Status")}
          actions={
            <StatusBadge tone={detailModel.status === "failed" ? "error" : "progress"}>
              {detailModel.status ?? detailModel.toolType}
            </StatusBadge>
          }
        />
        <CollapsibleSection
          title="Invocation"
          subtitle="Parameters, output, and diagnostics from the tool run"
          defaultOpen
        >
          <pre className={styles.preformattedBlock}>{detailModel.detail}</pre>
          {detailModel.output ? <pre className={styles.logBlock}>{detailModel.output}</pre> : null}
          {detailModel.diagnostics.length > 0 ? (
            <pre className={styles.logBlock}>{detailModel.diagnostics.join("\n")}</pre>
          ) : null}
        </CollapsibleSection>
        {detailModel.changes.length > 0 ? (
          <InspectorSection>
            <InspectorSectionHeader
              title="Changed files"
              subtitle={`${detailModel.changes.length} edits produced by the tool`}
            />
            <InspectorSectionBody>
              <EvidenceList>
                {detailModel.changes.map((change) => (
                  <EvidenceRow
                    key={`${change.path}-${change.kind ?? "modified"}`}
                    label={change.kind ?? "modified"}
                    value={change.path}
                  />
                ))}
              </EvidenceList>
            </InspectorSectionBody>
          </InspectorSection>
        ) : null}
        <SelectionActions clearSelection={clearSelection} hasSelection={hasSelection} />
      </>
    );
  }

  if (detailModel.kind === "reasoning") {
    return (
      <>
        <DetailHero eyebrow="Reasoning" title={detailModel.title} subtitle={detailModel.subtitle} />
        <NarrativeBlock>{detailModel.content}</NarrativeBlock>
        <SelectionActions clearSelection={clearSelection} hasSelection={hasSelection} />
      </>
    );
  }

  if (detailModel.kind === "explore") {
    return (
      <>
        <DetailHero
          eyebrow="Exploration"
          title={detailModel.title}
          subtitle={detailModel.subtitle}
          metrics={withoutMetric(detailModel.metrics, "Status")}
          actions={<StatusBadge tone="progress">{detailModel.status}</StatusBadge>}
        />
        <InspectorSection>
          <InspectorSectionHeader
            title="Recorded actions"
            subtitle="Searches, reads, listings, and shell activity"
          />
          <InspectorSectionBody>
            <EvidenceList>
              {detailModel.entries.map((entry, index) => (
                <EvidenceRow
                  key={`${entry.kind}-${entry.label}-${index}`}
                  label={entry.kind}
                  value={entry.detail ? `${entry.label} - ${entry.detail}` : entry.label}
                />
              ))}
            </EvidenceList>
          </InspectorSectionBody>
        </InspectorSection>
        <SelectionActions clearSelection={clearSelection} hasSelection={hasSelection} />
      </>
    );
  }

  if (detailModel.kind === "review") {
    return (
      <>
        <DetailHero
          eyebrow="Review note"
          title={detailModel.title}
          subtitle={detailModel.subtitle}
          actions={<StatusBadge tone="warning">{detailModel.state}</StatusBadge>}
        />
        <NarrativeBlock>{detailModel.text}</NarrativeBlock>
        <SelectionActions clearSelection={clearSelection} hasSelection={hasSelection} />
      </>
    );
  }

  return (
    <>
      <DetailHero
        eyebrow={detailModel.role === "assistant" ? "Assistant message" : "User message"}
        title={detailModel.title}
        subtitle={detailModel.subtitle}
      />
      <NarrativeBlock>{detailModel.text}</NarrativeBlock>
      <SelectionActions clearSelection={clearSelection} hasSelection={hasSelection} />
    </>
  );
}

function DiffFileList({ files }: { files: RightPanelDiffFile[] }) {
  if (files.length === 0) {
    return (
      <NarrativeBlock>
        <Text as="span" size="fine" tone="muted">
          No changed file summary was published for this diff.
        </Text>
      </NarrativeBlock>
    );
  }

  return (
    <InspectorSection>
      <InspectorSectionHeader title="Changed files" subtitle={`${files.length} files in scope`} />
      <InspectorSectionBody>
        <div className={styles.diffList}>
          {files.map((file) => (
            <div key={`${file.status}-${file.path}`} className={styles.diffRow}>
              <Badge
                className={styles.diffStatusBadge}
                tone={getDiffStatusBadgeTone(file.status)}
                shape="chip"
                size="md"
              >
                {getDiffStatusLabel(file.status)}
              </Badge>
              <span className={styles.metadataValue}>{file.path}</span>
            </div>
          ))}
        </div>
      </InspectorSectionBody>
    </InspectorSection>
  );
}

function SelectionActions({ clearSelection, hasSelection }: SelectionActionsProps) {
  if (!hasSelection) {
    return null;
  }

  return (
    <StickySectionActions>
      <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
        Clear selection
      </Button>
    </StickySectionActions>
  );
}

import { useEffect } from "react";
import { CardDescription, CardTitle, StatusBadge, Surface, Text } from "../../design-system";
import type { ApprovalRequest, ConversationItem } from "../../types";
import { RightPanelInspectorProvider, useRightPanelInspector } from "./RightPanelInspectorContext";
import { ThreadRightPanel } from "./ThreadRightPanel";
import { ThreadRightPanelDetails } from "./ThreadRightPanelDetails";
import { ArtifactSummaryBlock } from "./RightPanelBlocks";
import * as styles from "./RightPanelV2VisualFixture.css";

const FIXTURE_ITEMS: ConversationItem[] = [
  {
    id: "tool-validate",
    kind: "tool",
    toolType: "exec",
    title: "Run validation",
    detail: "pnpm validate:fast",
    status: "completed",
    output: "validate:fast finished without regressions",
    durationMs: 1820,
    changes: [
      { path: "apps/code/src/features/right-panel/ThreadRightPanel.tsx", kind: "modified" },
      {
        path: "apps/code/src/features/right-panel/RightPanelDetailViews.tsx",
        kind: "added",
      },
    ],
  },
  {
    id: "reasoning-layout",
    kind: "reasoning",
    summary: "Inspector layout",
    content:
      "Collapse chrome duplication, keep the selected artifact visible, and stack evidence under a single scrolling rail.",
  },
  {
    id: "review-note",
    kind: "review",
    state: "completed",
    text: "The rail now reads like a professional inspector instead of a pile of unrelated cards.",
  },
];

const FIXTURE_APPROVALS: ApprovalRequest[] = [
  {
    workspace_id: "workspace-web",
    request_id: "approval-right-rail",
    method: "shell.exec",
    params: {
      command: ["pnpm", "test:e2e:smoke"],
      justification: "Verify the upgraded right rail in a browser-backed flow.",
    },
  },
];

function FixtureSelectionBootstrap() {
  const { selectItem } = useRightPanelInspector();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      selectItem("tool", "tool-validate");
    }, 0);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [selectItem]);

  return null;
}

function FixtureArtifactCopy() {
  return (
    <>
      <ArtifactSummaryBlock
        title="Working tree"
        subtitle="Diff, file, and prompt surfaces stay available without overwhelming the inspector."
      >
        <Text as="p" size="fine" tone="muted">
          Linear-style rails work because the shell stays compact while the selected evidence gets
          the emphasis. This fixture pins that relationship so the right panel can be visually
          audited in isolation.
        </Text>
      </ArtifactSummaryBlock>
      <ArtifactSummaryBlock
        title="Execution plan"
        subtitle="The nearby plan stays subordinate to the selected evidence."
      >
        <Text as="p" size="fine" tone="muted">
          Ship a denser header, one attention strip, and richer detail cards with collapsible raw
          evidence.
        </Text>
      </ArtifactSummaryBlock>
    </>
  );
}

function FixtureArtifactColumn({
  title,
  subtitle,
  body,
}: {
  title: string;
  subtitle: string;
  body: string;
}) {
  return (
    <ArtifactSummaryBlock title={title} subtitle={subtitle}>
      <Text as="p" size="fine" tone="muted">
        {body}
      </Text>
    </ArtifactSummaryBlock>
  );
}

export function RightPanelV2VisualFixture() {
  return (
    <main className={styles.shell} data-visual-fixture="right-panel-v2">
      <div className={styles.hero}>
        <span className={styles.eyebrow}>Right Rail V2 Fixture</span>
        <div className={styles.titleRow}>
          <CardTitle>Workspace inspector regression scene</CardTitle>
          <div className={styles.chipRow}>
            <StatusBadge>Linear-inspired</StatusBadge>
            <StatusBadge tone="progress">V2 shell</StatusBadge>
            <StatusBadge tone="warning">Attention + detail</StatusBadge>
          </div>
        </div>
        <CardDescription className={styles.subtitle}>
          Browser fixture for the rebuilt right rail: tabs-first navigation, blocking context, and
          the new detail component tree for tool output and selection evidence.
        </CardDescription>
      </div>

      <div className={styles.frame}>
        <Surface className={styles.workspaceSurface} padding="none" tone="elevated">
          <div className={styles.workspaceHeader}>
            <span className={styles.eyebrow}>Workspace body</span>
            <CardTitle>Primary thread surface placeholder</CardTitle>
            <CardDescription>
              The left side stays intentionally quieter. The right rail carries context, action
              readiness, and deep inspection.
            </CardDescription>
          </div>
          <div className={styles.workspaceBody}>
            <div className={styles.workspaceCard}>
              <Text as="p" size="meta" tone="strong">
                Prompt
              </Text>
              <Text as="p" size="fine" tone="muted">
                Rebuild the right rail around a simple tab mental model and keep deeper evidence in
                a single focused column.
              </Text>
            </div>
            <div className={styles.workspaceCard}>
              <Text as="p" size="meta" tone="strong">
                Agent progress
              </Text>
              <Text as="p" size="fine" tone="muted">
                Validation ran, design direction settled, and the runtime is paused on the final
                smoke pass approval. The right rail should make that state instantly legible.
              </Text>
            </div>
          </div>
        </Surface>

        <div className={styles.rightRail}>
          <RightPanelInspectorProvider scopeKey="fixture-right-panel-v2">
            <FixtureSelectionBootstrap />
            <ThreadRightPanel
              interruptNode={
                <ThreadRightPanelDetails
                  section="interrupt"
                  items={FIXTURE_ITEMS}
                  threadId="thread-right-panel-v2"
                  workspaceLoadError={null}
                  selectedDiffPath={null}
                  gitDiffs={[]}
                  turnDiff={null}
                  approvalRequests={FIXTURE_APPROVALS}
                  userInputRequests={[]}
                  toolCallRequests={[]}
                />
              }
              detailNode={
                <ThreadRightPanelDetails
                  section="detail"
                  items={FIXTURE_ITEMS}
                  threadId="thread-right-panel-v2"
                  workspaceLoadError={null}
                  selectedDiffPath={null}
                  gitDiffs={[]}
                  turnDiff={null}
                  approvalRequests={FIXTURE_APPROVALS}
                  userInputRequests={[]}
                  toolCallRequests={[]}
                />
              }
              gitNode={
                <FixtureArtifactColumn
                  title="Git workspace"
                  subtitle="Branch status, staged changes, and review controls."
                  body="This tab should feel operational and compact, with repo health easy to scan before you dive into a diff."
                />
              }
              filesNode={
                <FixtureArtifactColumn
                  title="Files workspace"
                  subtitle="Tree navigation, modified state, and insertion affordances."
                  body="The file surface should read quieter than Git, but still belong to the same rail family."
                />
              }
              promptsNode={
                <FixtureArtifactColumn
                  title="Prompt library"
                  subtitle="Reusable commands for the current workspace."
                  body="Prompt management belongs in context, but it should not visually overpower the selected evidence."
                />
              }
              planNode={<FixtureArtifactCopy />}
              diffNode={
                <FixtureArtifactColumn
                  title="Diff review"
                  subtitle="Selected patch context and review evidence."
                  body="The diff tab is the primary artifact view, so it should win the default focus whenever a patch is available."
                />
              }
              hasActivePlan
              hasDetailContent
            />
          </RightPanelInspectorProvider>
        </div>
      </div>
    </main>
  );
}

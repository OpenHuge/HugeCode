import {
  AgentStepSummaryBlock,
  DiffSummaryBlock,
  LogSnippetBlock,
} from "../../right-panel/RightPanelBlocks";
import {
  InspectorSectionGroup,
  InspectorSectionHeader,
  RightPanelBody,
  RightPanelHeader,
  RightPanelShell,
} from "../../right-panel/RightPanelPrimitives";
import { CardDescription, CardTitle, StatusBadge, Surface } from "../../../design-system";
import { GitDiffModeContent } from "./GitDiffPanelModeContent";
import * as styles from "./GitInspectorDetailVisualFixture.css";

export function GitInspectorDetailVisualFixture() {
  return (
    <main className={styles.shell} data-visual-fixture="git-inspector-detail">
      <div className={styles.frame}>
        <Surface className={styles.hero} padding="lg" tone="elevated">
          <span className={styles.eyebrow}>Git Inspector Fixture</span>
          <div className={styles.titleRow}>
            <CardTitle className={styles.title}>Git Detail Inspector Regression Scene</CardTitle>
            <div className={styles.chipRow}>
              <StatusBadge>Diff + preview</StatusBadge>
              <StatusBadge tone="progress">Inspector aligned</StatusBadge>
              <StatusBadge tone="warning">Fixture data</StatusBadge>
            </div>
          </div>
          <CardDescription className={styles.subtitle}>
            Deterministic visual regression scene for the tightened Git inspector grammar. This
            fixture gives stable browser evidence for the shared commit-message controls and right
            panel status treatment without depending on the full runtime-backed inspector shell.
          </CardDescription>
        </Surface>

        <div className={styles.workspaceGrid}>
          <div className={styles.panelStack}>
            <RightPanelShell className={styles.panelShell}>
              <RightPanelHeader
                eyebrow="Selection"
                title="Details"
                subtitle="Selected diff state, review note, and file context."
              />
              <RightPanelBody>
                <AgentStepSummaryBlock
                  title="Review changed file"
                  subtitle="Diff row selected from the Git context panel"
                  metrics={[
                    {
                      label: "File",
                      value: "apps/code/src/features/git/components/GitDiffPanelShared.tsx",
                    },
                    { label: "Status", value: "Modified" },
                    { label: "Scope", value: "Diff row hook cleanup" },
                  ]}
                />
                <DiffSummaryBlock
                  files={[
                    {
                      path: "apps/code/src/features/git/components/GitDiffPanelShared.tsx",
                      status: "modified",
                    },
                    {
                      path: "apps/code/src/features/git/hooks/useDiffFileSelection.ts",
                      status: "modified",
                    },
                  ]}
                  diff={`@@ Diff row hooks\n- className="diff-row"\n+ data-git-diff-row="true"\n+ data-selected="true"`}
                />
                <LogSnippetBlock
                  title="Review note"
                  content="Legacy diff hooks are now data attributes for selection and testing only. Styling stays local to the panel modules."
                />
              </RightPanelBody>
            </RightPanelShell>

            <div data-testid="git-inspector-plan-surface">
              <RightPanelShell className={styles.planPanelShell}>
                <RightPanelHeader
                  eyebrow="Workspace"
                  title="Plan"
                  subtitle="Nearby plan context should stay visually subordinate to diff detail."
                  actions={<StatusBadge tone="progress">2/4</StatusBadge>}
                />
                <RightPanelBody>
                  <InspectorSectionGroup>
                    <InspectorSectionHeader
                      title="Plan artifact"
                      subtitle="Fixture stand-in for the runtime-backed plan panel"
                      actions={<StatusBadge tone="progress">Next step</StatusBadge>}
                    />
                    <Surface className={styles.planArtifact} padding="md" tone="subtle">
                      <CardTitle className={styles.planArtifactTitle}>
                        Unify remaining Git row hooks
                      </CardTitle>
                      <CardDescription className={styles.planArtifactBody}>
                        Replace diff-row legacy classes with data attributes, then validate the
                        resulting Git inspector scene in a browser-visible fixture.
                      </CardDescription>
                    </Surface>
                    <ol className={styles.planStepList}>
                      <li className={styles.planStepRow}>
                        <span className={styles.planStepStatus}>[x]</span>
                        <span className={styles.planStepText}>
                          Move Git log, PR, issue, commit, and sync surfaces off the global bridge.
                        </span>
                      </li>
                      <li className={styles.planStepRow}>
                        <span className={styles.planStepStatus}>{"[>]"}</span>
                        <span className={styles.planStepText}>
                          Collapse diff-row legacy hooks into data attributes and local state.
                        </span>
                      </li>
                      <li className={styles.planStepRow}>
                        <span className={styles.planStepStatus}>[ ]</span>
                        <span className={styles.planStepText}>
                          Add a family-local Figma export before expanding beyond the current shared
                          Git controls.
                        </span>
                      </li>
                    </ol>
                    <p className={styles.planNote}>
                      Fixture note: this scene now focuses on the current verification target. It
                      verifies shared component rendering and layout stability before more family
                      expansion.
                    </p>
                  </InspectorSectionGroup>
                </RightPanelBody>
              </RightPanelShell>
            </div>
          </div>

          <div className={styles.diffSurface} data-testid="git-inspector-diff-surface">
            <GitDiffModeContent
              error={null}
              showGitRootPanel={false}
              gitRootScanLoading={false}
              gitRootScanDepth={2}
              hasGitRoot
              gitRootScanError={null}
              gitRootScanHasScanned
              gitRootCandidates={[]}
              gitRoot="C:/Dev/Y/Y-keep-up"
              showGenerateCommitMessage
              commitMessage="feat: tighten git inspector regression scene"
              onCommitMessageChange={() => {}}
              commitMessageLoading={false}
              canGenerateCommitMessage
              onGenerateCommitMessage={() => {}}
              stagedFiles={[
                {
                  path: "apps/code/src/features/git/components/GitDiffPanelShared.tsx",
                  status: "M",
                  additions: 12,
                  deletions: 4,
                },
              ]}
              unstagedFiles={[
                {
                  path: "apps/code/src/features/git/hooks/useDiffFileSelection.ts",
                  status: "M",
                  additions: 4,
                  deletions: 1,
                },
                {
                  path: "apps/code/src/features/git/components/GitInspectorDetailVisualFixture.tsx",
                  status: "A",
                  additions: 86,
                  deletions: 0,
                },
                {
                  path: "tests/e2e/src/code/design-system-fixture-smoke.spec.ts",
                  status: "M",
                  additions: 24,
                  deletions: 0,
                },
              ]}
              commitLoading={false}
              onCommit={() => {}}
              commitsAhead={2}
              commitsBehind={1}
              onPull={() => {}}
              pullLoading={false}
              onPush={() => {}}
              pushLoading={false}
              onSync={() => {}}
              syncLoading={false}
              onStageAllChanges={() => {}}
              onStageFile={() => {}}
              onUnstageFile={() => {}}
              onDiscardFile={() => {}}
              onDiscardFiles={() => {}}
              selectedFiles={new Set(["apps/code/src/features/git/hooks/useDiffFileSelection.ts"])}
              selectedPath="apps/code/src/features/git/hooks/useDiffFileSelection.ts"
              onFileClick={() => {}}
              onShowFileMenu={() => {}}
              onDiffListClick={() => {}}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

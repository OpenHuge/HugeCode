import Activity from "lucide-react/dist/esm/icons/activity";
import Bot from "lucide-react/dist/esm/icons/bot";
import LifeBuoy from "lucide-react/dist/esm/icons/life-buoy";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import {
  ActivityLogRow,
  DiffReviewPanel,
  ExecutionStatusPill,
  ToolCallChip,
  type DiffReviewFileEntry,
} from "../../../../design-system";
import * as fixtureStyles from "./ExecutionDetailVisualFixture.css";

const changedFiles: DiffReviewFileEntry[] = [
  {
    path: "apps/code/src/features/workspaces/components/WorkspaceHomeAgentRuntimeOrchestration.tsx",
    status: "updated",
  },
  { path: "apps/code/src/features/review/components/ReviewPackSurface.tsx", status: "updated" },
  {
    path: "apps/code/src/features/messages/components/MessageTimelinePanels.tsx",
    status: "updated",
  },
];

export function MissionControlVisualFixture() {
  return (
    <main className={fixtureStyles.shell} data-visual-fixture="mission-control">
      <div className={fixtureStyles.frame}>
        <section className={fixtureStyles.hero}>
          <span className={fixtureStyles.eyebrow}>Mission Control Fixture</span>
          <div className={fixtureStyles.titleRow}>
            <h1 className={fixtureStyles.title}>Runtime Supervision Surface</h1>
            <div className={fixtureStyles.chipRow}>
              <ToolCallChip tone="neutral" icon={<Bot size={12} />}>
                runtime-backed
              </ToolCallChip>
              <ExecutionStatusPill tone="running" emphasis="strong" showDot>
                Supervision active
              </ExecutionStatusPill>
            </div>
          </div>
          <p className={fixtureStyles.subtitle}>
            Visual regression harness for launch readiness, approval pressure, and run supervision
            using the shared execution-detail chrome.
          </p>
        </section>

        <div className={fixtureStyles.contentGrid}>
          <section className={fixtureStyles.sectionStack} aria-label="Mission control sections">
            <ActivityLogRow
              tone="warning"
              icon={<ShieldAlert size={16} />}
              title="Launch readiness blocked"
              description="Runtime transport is healthy, but approval pressure is stale and should be resolved before launch."
              meta={
                <>
                  <ToolCallChip tone="neutral">Route auto</ToolCallChip>
                  <ToolCallChip tone="neutral">Stale approvals 2</ToolCallChip>
                  <ExecutionStatusPill tone="warning" showDot>
                    Attention
                  </ExecutionStatusPill>
                </>
              }
            />

            <ActivityLogRow
              tone="success"
              icon={<LifeBuoy size={16} />}
              title="Continuity readiness confirmed"
              description="Checkpoint and handoff data are published for another control device."
              meta={
                <>
                  <ToolCallChip tone="neutral">Resume ready 1</ToolCallChip>
                  <ToolCallChip tone="neutral">Handoff ready 1</ToolCallChip>
                  <ExecutionStatusPill tone="success" showDot>
                    Ready
                  </ExecutionStatusPill>
                </>
              }
            />

            <DiffReviewPanel
              title="Run list"
              description="Execution changes captured across Mission Control, Review Pack, and timeline surfaces."
              summaryLabel="3 files changed"
              statusLabel="In progress"
              statusTone="running"
              files={changedFiles}
              expanded
            >
              <pre className={fixtureStyles.codeBlock}>
                {`Mission Control -> Review Pack -> Timeline
unified execution chrome
no page-local status drift`}
              </pre>
            </DiffReviewPanel>
          </section>

          <aside className={fixtureStyles.sidePanel} aria-label="Mission control context">
            <div className={fixtureStyles.sectionStack}>
              <h2 className={fixtureStyles.panelTitle}>Control Loop</h2>
              <p className={fixtureStyles.panelDescription}>
                Observe, approve, intervene, and resume without rebuilding runtime truth in the UI.
              </p>
              <div className={fixtureStyles.chipRow}>
                <ToolCallChip tone="neutral" icon={<Activity size={12} />}>
                  launch readiness
                </ToolCallChip>
                <ToolCallChip tone="neutral">continuity</ToolCallChip>
                <ToolCallChip tone="neutral">review handoff</ToolCallChip>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

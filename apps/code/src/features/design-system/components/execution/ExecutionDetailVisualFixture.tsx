import Activity from "lucide-react/dist/esm/icons/activity";
import Bot from "lucide-react/dist/esm/icons/bot";
import FileCode2 from "lucide-react/dist/esm/icons/file-code-2";
import Search from "lucide-react/dist/esm/icons/search";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import {
  ActivityLogRow,
  DiffReviewPanel,
  ExecutionStatusPill,
  ToolCallChip,
  type DiffReviewFileEntry,
} from "../../../../design-system";
import * as fixtureStyles from "./ExecutionDetailVisualFixture.css";

const changedFiles: DiffReviewFileEntry[] = [
  { path: "apps/code/src/features/messages/components/MessageRows.tsx", status: "updated" },
  {
    path: "apps/code/src/design-system/components/execution/ExecutionPrimitives.css.ts",
    status: "updated",
  },
  { path: "tests/e2e/src/code/core-visual-regression.spec.ts", status: "added" },
];

export function ExecutionDetailVisualFixture() {
  return (
    <main className={fixtureStyles.shell} data-visual-fixture="execution-detail">
      <div className={fixtureStyles.frame}>
        <section className={fixtureStyles.hero}>
          <span className={fixtureStyles.eyebrow}>Execution Detail Fixture</span>
          <div className={fixtureStyles.titleRow}>
            <h1 className={fixtureStyles.title}>Agent Run Review</h1>
            <div className={fixtureStyles.chipRow}>
              <ToolCallChip tone="neutral" icon={<Bot size={12} />}>
                workspace agent
              </ToolCallChip>
              <ToolCallChip tone="neutral" icon={<Sparkles size={12} />}>
                planning + apply
              </ToolCallChip>
              <ExecutionStatusPill tone="running" emphasis="strong" showDot>
                In progress
              </ExecutionStatusPill>
            </div>
          </div>
          <p className={fixtureStyles.subtitle}>
            Stable chrome, restrained state emphasis, and dense execution summaries tuned for code,
            logs, and diff review. This fixture exists only for Playwright visual regression.
          </p>
        </section>

        <div className={fixtureStyles.contentGrid}>
          <section className={fixtureStyles.sectionStack} aria-label="Execution activity">
            <ActivityLogRow
              tone="running"
              icon={<Search size={16} />}
              title="Repository scan started"
              description="Inspecting message timeline and workspace runtime surfaces before component extraction."
              meta={
                <>
                  <ToolCallChip tone="neutral">rg components</ToolCallChip>
                  <ExecutionStatusPill tone="running" showDot>
                    Running
                  </ExecutionStatusPill>
                  <ToolCallChip tone="neutral">14 files</ToolCallChip>
                </>
              }
              interactive
              selected
            />

            <ActivityLogRow
              tone="success"
              icon={<Activity size={16} />}
              title="Execution primitives converged"
              description="Status pills, tool chips, and activity rows now share semantic token bindings instead of page-private values."
              meta={
                <>
                  <ToolCallChip tone="neutral">component layer</ToolCallChip>
                  <ExecutionStatusPill tone="success" showDot>
                    Completed
                  </ExecutionStatusPill>
                  <ToolCallChip tone="neutral">token-first</ToolCallChip>
                </>
              }
              body={
                <pre className={fixtureStyles.codeBlock}>
                  {`+ export const statusPillTone = styleVariants(...)
+ export const toolCallChipTone = styleVariants(...)
- legacy per-page status class mapping`}
                </pre>
              }
            />

            <DiffReviewPanel
              title="Review execution detail surfaces"
              description="Diff summary for execution-state primitives and the visual regression harness."
              summaryLabel="3 files changed"
              statusLabel="Ready for review"
              statusTone="success"
              files={changedFiles}
              expanded
            >
              <pre className={fixtureStyles.codeBlock}>
                {`diff --git a/tests/e2e/src/code/core-visual-regression.spec.ts b/tests/e2e/src/code/core-visual-regression.spec.ts
 await page.goto("/fixtures.html?fixture=execution-detail");
 await expect(page.locator('[data-visual-fixture="execution-detail"]')).toHaveScreenshot(...)

 <ActivityLogRow tone="success" ... />
 <DiffReviewPanel statusTone="success" ... />`}
              </pre>
            </DiffReviewPanel>
          </section>

          <aside className={fixtureStyles.sidePanel} aria-label="Execution context">
            <div className={fixtureStyles.sectionStack}>
              <h2 className={fixtureStyles.panelTitle}>Changed Files</h2>
              <p className={fixtureStyles.panelDescription}>
                Compact side context for diff/file-tree style regression coverage.
              </p>
              <ul className={fixtureStyles.fileList}>
                {changedFiles.map((file) => (
                  <li key={file.path} className={fixtureStyles.fileRow}>
                    <div className={fixtureStyles.chipRow}>
                      <ToolCallChip tone="neutral" icon={<FileCode2 size={12} />}>
                        {file.status}
                      </ToolCallChip>
                    </div>
                    <span className={fixtureStyles.filePath}>{file.path}</span>
                    <span className={fixtureStyles.fileMeta}>
                      semantic tokens + reusable execution chrome
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={fixtureStyles.sectionStack}>
              <h2 className={fixtureStyles.panelTitle}>Review Notes</h2>
              <p className={fixtureStyles.panelDescription}>
                No glassy cards, no heavy elevation, and no page-private color drift.
              </p>
              <div className={fixtureStyles.chipRow}>
                <ExecutionStatusPill tone="warning" showDot>
                  Legacy aliases still bridged
                </ExecutionStatusPill>
                <ToolCallChip tone="neutral">light / dark / dim</ToolCallChip>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

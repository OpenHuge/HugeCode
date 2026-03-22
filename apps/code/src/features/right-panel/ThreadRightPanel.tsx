import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../design-system";
import { getLatestPlanPanelRequestId, onOpenPlanPanel } from "../plan/utils/planPanelSurface";
import {
  InspectorSectionBody,
  RightPanelBody,
  RightPanelEmptyState,
  RightPanelShell,
  RightPanelTopBar,
  RightRailSection,
} from "./RightPanelPrimitives";
import { useOptionalRightPanelInspector } from "./RightPanelInspectorContext";
import * as styles from "./RightPanelPrimitives.css";

type ThreadRightPanelProps = {
  interruptNode: ReactNode;
  detailNode: ReactNode;
  gitNode: ReactNode;
  filesNode: ReactNode;
  promptsNode: ReactNode;
  planNode: ReactNode;
  diffNode: ReactNode;
  hasDiffContent?: boolean;
  hasActivePlan: boolean;
  hasDetailContent: boolean;
};

type RailTab = "diff" | "git" | "files" | "context";

export function ThreadRightPanel({
  interruptNode,
  detailNode,
  gitNode,
  filesNode,
  promptsNode,
  planNode,
  diffNode,
  hasDiffContent = diffNode != null,
  hasActivePlan,
  hasDetailContent,
}: ThreadRightPanelProps) {
  const tabIdBase = useId().replace(/:/g, "");
  const inspector = useOptionalRightPanelInspector();
  const hasDiff = hasDiffContent && diffNode != null;
  const selectionFocusKey = inspector?.selection
    ? `${inspector.selection.kind}:${inspector.selection.itemId}`
    : null;
  const hasContext = Boolean(
    hasActivePlan || hasDetailContent || promptsNode || inspector?.selection
  );
  const [activeTab, setActiveTab] = useState<RailTab>(() =>
    resolveDefaultRailTab({
      hasDiff,
      hasGit: gitNode != null,
      hasFiles: filesNode != null,
      hasContext,
      preferContext: Boolean(selectionFocusKey),
    })
  );
  const handledPlanPanelRequestIdRef = useRef(0);

  useEffect(() => {
    if (!selectionFocusKey || !hasContext) {
      return;
    }
    if (activeTab === "context") {
      return;
    }
    setActiveTab("context");
  }, [activeTab, hasContext, selectionFocusKey]);
  const openPlanContext = useCallback(
    (requestId: number) => {
      if (!hasActivePlan || requestId <= handledPlanPanelRequestIdRef.current) {
        return;
      }
      handledPlanPanelRequestIdRef.current = requestId;
      setActiveTab("context");
    },
    [hasActivePlan]
  );

  useEffect(
    () =>
      onOpenPlanPanel((requestId) => {
        openPlanContext(requestId);
      }),
    [openPlanContext]
  );

  useEffect(() => {
    openPlanContext(getLatestPlanPanelRequestId());
  }, [openPlanContext]);

  const tabs = buildRailTabs();
  const activeSection = activeTab === "context" ? "detail" : "artifact";

  return (
    <RightPanelShell>
      <Tabs
        idBase={`${tabIdBase}-tab`}
        value={activeTab}
        onValueChange={(id) => setActiveTab(id as RailTab)}
      >
        {tabs.length > 0 ? (
          <RightPanelTopBar>
            <TabsList className={styles.tabList} aria-label="Right rail">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className={styles.tab}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </RightPanelTopBar>
        ) : null}
        <RightPanelBody>
          {interruptNode ? (
            <RightRailSection section="interrupt" data-testid="right-panel-interrupt-strip">
              {interruptNode}
            </RightRailSection>
          ) : null}
          {tabs.length > 0 ? (
            <RightRailSection section={activeSection}>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <TabsContent
                    key={tab.id}
                    value={tab.id}
                    className={styles.tabPanel}
                    {...(isActive
                      ? {
                          "data-testid": "right-panel-primary-artifact",
                          "data-artifact-mode": tab.id,
                        }
                      : {})}
                  >
                    {isActive
                      ? renderRailPanel(tab.id, {
                          diffNode,
                          gitNode,
                          filesNode,
                          planNode,
                          detailNode,
                          promptsNode,
                        })
                      : null}
                  </TabsContent>
                );
              })}
            </RightRailSection>
          ) : null}
        </RightPanelBody>
      </Tabs>
    </RightPanelShell>
  );
}

function ContextRailContent({
  planNode,
  detailNode,
  promptsNode,
}: {
  planNode: ReactNode;
  detailNode: ReactNode;
  promptsNode: ReactNode;
}) {
  if (!planNode && !detailNode && !promptsNode) {
    return null;
  }

  return (
    <InspectorSectionBody>
      {planNode}
      {detailNode}
      {promptsNode}
    </InspectorSectionBody>
  );
}

function renderRailPanel(
  tab: RailTab,
  nodes: {
    diffNode: ReactNode;
    gitNode: ReactNode;
    filesNode: ReactNode;
    planNode: ReactNode;
    detailNode: ReactNode;
    promptsNode: ReactNode;
  }
) {
  if (tab === "diff") {
    return (
      nodes.diffNode ?? (
        <RailTabEmptyState
          title="Diff is waiting"
          body="Select a changed file or pull request diff to inspect patches here."
        />
      )
    );
  }
  if (tab === "git") {
    return (
      nodes.gitNode ?? (
        <RailTabEmptyState
          title="Git details unavailable"
          body="Branch status, staged changes, and commit actions will appear here once the workspace is ready."
        />
      )
    );
  }
  if (tab === "files") {
    return (
      nodes.filesNode ?? (
        <RailTabEmptyState
          title="Files are unavailable"
          body="Workspace files and modified paths will appear here after the project tree loads."
        />
      )
    );
  }
  return nodes.planNode || nodes.detailNode || nodes.promptsNode ? (
    <ContextRailContent
      planNode={nodes.planNode}
      detailNode={nodes.detailNode}
      promptsNode={nodes.promptsNode}
    />
  ) : (
    <RailTabEmptyState
      title="Context will appear here"
      body="Plan progress, file details, and prompt context stay docked in this tab."
    />
  );
}

function buildRailTabs() {
  return [
    { id: "diff", label: "Diff" },
    { id: "git", label: "Git" },
    { id: "files", label: "Files" },
    { id: "context", label: "Context" },
  ] satisfies Array<{ id: RailTab; label: string }>;
}

function resolveDefaultRailTab({
  hasDiff,
  hasGit,
  hasFiles,
  hasContext,
  preferContext = false,
}: {
  hasDiff: boolean;
  hasGit: boolean;
  hasFiles: boolean;
  hasContext: boolean;
  preferContext?: boolean;
}) {
  if (preferContext && hasContext) {
    return "context";
  }
  if (hasDiff) {
    return "diff";
  }
  if (hasGit) {
    return "git";
  }
  if (hasFiles) {
    return "files";
  }
  if (hasContext) {
    return "context";
  }
  return "context";
}

function RailTabEmptyState({ title, body }: { title: string; body: string }) {
  return <RightPanelEmptyState title={title} body={body} />;
}

import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import type { GitHubPanelDataProps } from "../../git/components/GitHubPanelData";
import type { MobileServerSetupWizardProps } from "../../mobile/components/MobileServerSetupWizard";
import type { AppLayoutProps } from "./AppLayout";
import type { AppModalsProps } from "./AppModals";
import { MainAppShell } from "./MainAppShell";
import { RightPanelInspectorProvider } from "../../right-panel/RightPanelInspectorContext";

type WorkspaceDesktopAppHostProps = {
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  activeWorkspace: GitHubPanelDataProps["activeWorkspace"];
  gitPanelMode: GitHubPanelDataProps["gitPanelMode"];
  shouldLoadDiffs: GitHubPanelDataProps["shouldLoadDiffs"];
  diffSource: GitHubPanelDataProps["diffSource"];
  selectedPullRequestNumber: number | null;
  onIssuesChange: GitHubPanelDataProps["onIssuesChange"];
  onPullRequestsChange: GitHubPanelDataProps["onPullRequestsChange"];
  onPullRequestDiffsChange: GitHubPanelDataProps["onPullRequestDiffsChange"];
  onPullRequestCommentsChange: GitHubPanelDataProps["onPullRequestCommentsChange"];
  appClassName: string;
  appStyle: CSSProperties;
  shouldLoadGitHubPanelData: boolean;
  appLayoutProps: AppLayoutProps;
  appModalsProps: AppModalsProps;
  titlebarControlsNode: ReactNode;
  showMobileSetupWizard: boolean;
  mobileSetupWizardProps: MobileServerSetupWizardProps;
};

export function WorkspaceDesktopAppHost({
  activeWorkspaceId,
  activeThreadId,
  activeWorkspace,
  gitPanelMode,
  shouldLoadDiffs,
  diffSource,
  selectedPullRequestNumber,
  onIssuesChange,
  onPullRequestsChange,
  onPullRequestDiffsChange,
  onPullRequestCommentsChange,
  appClassName,
  appStyle,
  shouldLoadGitHubPanelData,
  appLayoutProps,
  appModalsProps,
  titlebarControlsNode,
  showMobileSetupWizard,
  mobileSetupWizardProps,
}: WorkspaceDesktopAppHostProps) {
  const gitHubPanelDataProps = useMemo(
    () => ({
      activeWorkspace,
      gitPanelMode,
      shouldLoadDiffs,
      diffSource,
      selectedPullRequestNumber,
      onIssuesChange,
      onPullRequestsChange,
      onPullRequestDiffsChange,
      onPullRequestCommentsChange,
    }),
    [
      activeWorkspace,
      gitPanelMode,
      shouldLoadDiffs,
      diffSource,
      selectedPullRequestNumber,
      onIssuesChange,
      onPullRequestsChange,
      onPullRequestDiffsChange,
      onPullRequestCommentsChange,
    ]
  );

  return (
    <RightPanelInspectorProvider
      scopeKey={`${activeWorkspaceId ?? "none"}:${activeThreadId ?? "none"}`}
    >
      <MainAppShell
        appClassName={appClassName}
        appStyle={appStyle}
        shouldLoadGitHubPanelData={shouldLoadGitHubPanelData}
        gitHubPanelDataProps={gitHubPanelDataProps}
        appLayoutProps={appLayoutProps}
        appModalsProps={appModalsProps}
        titlebarControlsNode={titlebarControlsNode}
        showMobileSetupWizard={showMobileSetupWizard}
        mobileSetupWizardProps={mobileSetupWizardProps}
      />
    </RightPanelInspectorProvider>
  );
}

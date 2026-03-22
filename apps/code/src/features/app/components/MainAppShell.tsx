import type { CSSProperties } from "react";
import { lazy, memo, Suspense } from "react";
import type { GitHubPanelDataProps } from "../../git/components/GitHubPanelData";
import type { MobileServerSetupWizardProps } from "../../mobile/components/MobileServerSetupWizard";
import type { AppLayoutProps } from "./AppLayout";
import { AppLayout } from "./AppLayout";
import type { AppModalsProps } from "./AppModals";

const GitHubPanelData = lazy(() =>
  import("../../git/components/GitHubPanelData").then((module) => ({
    default: module.GitHubPanelData,
  }))
);
const AppModals = lazy(() =>
  import("./AppModals").then((module) => ({
    default: module.AppModals,
  }))
);
const MobileServerSetupWizard = lazy(() =>
  import("../../mobile/components/MobileServerSetupWizard").then((module) => ({
    default: module.MobileServerSetupWizard,
  }))
);

type MainAppShellProps = {
  appClassName: string;
  appStyle: CSSProperties;
  shouldLoadGitHubPanelData: boolean;
  gitHubPanelDataProps: GitHubPanelDataProps;
  appLayoutProps: AppLayoutProps;
  appModalsProps: AppModalsProps;
  showMobileSetupWizard: boolean;
  mobileSetupWizardProps: MobileServerSetupWizardProps;
};

export const MainAppShell = memo(function MainAppShell({
  appClassName,
  appStyle,
  shouldLoadGitHubPanelData,
  gitHubPanelDataProps,
  appLayoutProps,
  appModalsProps,
  showMobileSetupWizard,
  mobileSetupWizardProps,
}: MainAppShellProps) {
  const shouldLoadAppModals =
    appModalsProps.renamePrompt !== null ||
    appModalsProps.worktreePrompt !== null ||
    appModalsProps.clonePrompt !== null ||
    appModalsProps.branchSwitcher !== null ||
    appModalsProps.settingsOpen;

  return (
    <div className={appClassName} style={appStyle}>
      <div className="drag-strip" id="titlebar" data-tauri-drag-region />
      {shouldLoadGitHubPanelData ? (
        <Suspense fallback={null}>
          <GitHubPanelData {...gitHubPanelDataProps} />
        </Suspense>
      ) : null}
      <AppLayout {...appLayoutProps} />
      {shouldLoadAppModals ? (
        <Suspense fallback={null}>
          <AppModals {...appModalsProps} />
        </Suspense>
      ) : null}
      {showMobileSetupWizard ? (
        <Suspense fallback={null}>
          <MobileServerSetupWizard {...mobileSetupWizardProps} />
        </Suspense>
      ) : null}
    </div>
  );
});

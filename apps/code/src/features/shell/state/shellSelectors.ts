import type { AppTab } from "../types/shellRoute";

const MISSING_WORKSPACE_TAB_REASON = "Select or connect a workspace to use this tab.";

function canStayOnPhoneWithoutWorkspace(tab: AppTab): boolean {
  return tab === "home" || tab === "workspaces" || tab === "settings";
}

type CoerceShellTabOptions = {
  isPhone: boolean;
  hasActiveWorkspace: boolean;
};

export function getPhoneFallbackTab(activeTab: AppTab, hasActiveWorkspace: boolean): AppTab {
  if (hasActiveWorkspace || canStayOnPhoneWithoutWorkspace(activeTab)) {
    return activeTab;
  }
  return "home";
}

export function coerceShellTab(activeTab: AppTab, options: CoerceShellTabOptions): AppTab {
  if (options.isPhone) {
    return getPhoneFallbackTab(activeTab, options.hasActiveWorkspace);
  }
  return activeTab;
}

export function getPhoneTabDisabledReason(tab: AppTab, hasActiveWorkspace: boolean): string | null {
  if (!hasActiveWorkspace && (tab === "missions" || tab === "review")) {
    return MISSING_WORKSPACE_TAB_REASON;
  }
  return null;
}

export function getPhoneTabSelection(tab: AppTab, hasActiveWorkspace: boolean): AppTab {
  if (getPhoneTabDisabledReason(tab, hasActiveWorkspace) !== null) {
    return "workspaces";
  }
  return tab;
}

import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import type { SettingsShellFraming } from "../settings-shell";
import type {
  WorkspaceCatalogEntry,
  WorkspaceClientHostStartupStatus,
  WorkspaceClientRuntimeMode,
} from "../workspace/bindings";
import type { MissionControlLoadState } from "./missionControlSnapshotStore";
import type { SharedMissionControlSummary } from "./sharedMissionControlSummary";
import type {
  SharedWorkspaceRouteSelection,
  SharedWorkspaceShellSection,
} from "./workspaceNavigation";

export type SharedWorkspaceShellCatalogState = {
  workspaces: WorkspaceCatalogEntry[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceCatalogEntry | null;
  hasPendingWorkspaceSelection: boolean;
  loadState: MissionControlLoadState;
  error: string | null;
  refresh: () => Promise<void>;
  selectWorkspace: (workspaceId: string | null) => void;
};

export type SharedWorkspaceShellMissionControlState = {
  summary: SharedMissionControlSummary;
  snapshot: HugeCodeMissionControlSnapshot | null;
  loadState: MissionControlLoadState;
  error: string | null;
  refresh: () => Promise<void>;
};

export type SharedWorkspaceShellHostStartupState = {
  status: WorkspaceClientHostStartupStatus | null;
  loadState: "idle" | "loading" | "refreshing" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
};

export type SharedWorkspaceShellFrameState = {
  runtimeMode: WorkspaceClientRuntimeMode;
  platformHint: string;
  routeSelection: SharedWorkspaceRouteSelection;
  activeSection: SharedWorkspaceShellSection;
  backgroundEnabled: boolean;
  accountHref: string | null;
  settingsFraming: SettingsShellFraming;
};

export type SharedWorkspaceShellState = {
  runtimeMode: WorkspaceClientRuntimeMode;
  platformHint: string;
  routeSelection: SharedWorkspaceRouteSelection;
  activeSection: SharedWorkspaceShellSection;
  workspaces: WorkspaceCatalogEntry[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceCatalogEntry | null;
  hasPendingWorkspaceSelection: boolean;
  workspaceLoadState: MissionControlLoadState;
  workspaceError: string | null;
  refreshWorkspaces: () => Promise<void>;
  selectWorkspace: (workspaceId: string | null) => void;
  navigateToSection: (section: SharedWorkspaceShellSection) => void;
  missionSummary: SharedMissionControlSummary;
  missionSnapshot: HugeCodeMissionControlSnapshot | null;
  missionLoadState: MissionControlLoadState;
  missionError: string | null;
  refreshMissionSummary: () => Promise<void>;
  hostStartupStatus: WorkspaceClientHostStartupStatus | null;
  hostStartupLoadState: SharedWorkspaceShellHostStartupState["loadState"];
  hostStartupError: string | null;
  refreshHostStartupStatus: () => Promise<void>;
  accountHref: string | null;
  settingsFraming: SettingsShellFraming;
};

export type SharedWorkspaceShellFrameStateCompositionInput = {
  runtimeMode: WorkspaceClientRuntimeMode;
  platformHint: string;
  routeSelection: SharedWorkspaceRouteSelection;
  activationRequested: boolean;
  activationDeferred: boolean;
  accountHref: string | null;
  settingsFraming: SettingsShellFraming;
};

export type SharedWorkspaceShellStateCompositionInput = {
  frameState: SharedWorkspaceShellFrameState;
  catalogState: SharedWorkspaceShellCatalogState;
  missionControlState: SharedWorkspaceShellMissionControlState;
  hostStartupState: SharedWorkspaceShellHostStartupState;
  navigateToSection: (section: SharedWorkspaceShellSection) => void;
};

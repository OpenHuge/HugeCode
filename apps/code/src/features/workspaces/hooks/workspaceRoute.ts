import { useSyncExternalStore } from "react";
import {
  buildSharedWorkspaceRoutePathname,
  readSharedWorkspaceRouteSelection,
  type SharedWorkspaceShellSection,
  type SharedWorkspaceRouteSelection,
  type WorkspaceNavigationAdapter,
  type WorkspaceNavigationOptions,
} from "@ku0/code-workspace-client/workspace-shell";

const WORKSPACE_BASE_PATH = "/workspaces";
const DESKTOP_MISSION_HOME_PATH = "/missions";
const DESKTOP_ROOT_HOME_PATH = "/";

type RouteListener = () => void;

function getRouteSelectionKey(selection: SharedWorkspaceRouteSelection): string {
  if (selection.kind !== "workspace") {
    return selection.kind;
  }
  return `workspace:${selection.workspaceId}`;
}

function readPathSelectionFromWindow(): SharedWorkspaceRouteSelection {
  if (typeof window === "undefined") {
    return { kind: "none" };
  }
  if (isDesktopWorkspaceRootAliasPath(window.location.pathname)) {
    canonicalizeDesktopWorkspaceEntryRoute();
    return { kind: "home" };
  }
  if (isDesktopMissionHomePath(window.location.pathname)) {
    return { kind: "missions" };
  }
  return readSharedWorkspaceRouteSelection(`${window.location.pathname}${window.location.search}`, {
    workspaceBasePath: WORKSPACE_BASE_PATH,
  });
}

export function isDesktopWorkspaceRootAliasPath(pathname: string): boolean {
  const routeUrl = new URL(pathname || "/", "https://workspace-shell.invalid");
  return normalizeDesktopRoutePathname(routeUrl.pathname) === DESKTOP_ROOT_HOME_PATH;
}

export function isDesktopMissionHomePath(pathname: string): boolean {
  const routeUrl = new URL(pathname || "/", "https://workspace-shell.invalid");
  return normalizeDesktopRoutePathname(routeUrl.pathname) === DESKTOP_MISSION_HOME_PATH;
}

function normalizeDesktopRoutePathname(pathname: string): string {
  if (!pathname) {
    return "/";
  }
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "") || "/";
  }
  return pathname;
}

function buildRouteUrl(pathWithSearch: string): string {
  if (typeof window === "undefined") {
    return pathWithSearch;
  }
  return `${pathWithSearch}${window.location.hash}`;
}

export function canonicalizeDesktopWorkspaceEntryRoute(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const currentPathWithSearch = `${window.location.pathname}${window.location.search}`;
  if (!isDesktopWorkspaceRootAliasPath(currentPathWithSearch)) {
    return false;
  }
  window.history.replaceState(window.history.state, "", buildRouteUrl(WORKSPACE_BASE_PATH));
  return true;
}

function commitRouteSelection(selection: SharedWorkspaceRouteSelection, replace: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  const pathWithSearch = buildSharedWorkspaceRoutePathname(selection, {
    workspaceBasePath: WORKSPACE_BASE_PATH,
  });
  if (!pathWithSearch) {
    return;
  }
  const currentPathWithSearch = `${window.location.pathname}${window.location.search}`;
  if (currentPathWithSearch === pathWithSearch) {
    return;
  }
  const nextUrl = buildRouteUrl(pathWithSearch);
  if (replace) {
    window.history.replaceState(window.history.state, "", nextUrl);
  } else {
    window.history.pushState(window.history.state, "", nextUrl);
  }
}

class DesktopWorkspaceNavigationAdapter implements WorkspaceNavigationAdapter {
  private listeners = new Set<RouteListener>();

  private restoreSelection: SharedWorkspaceRouteSelection = { kind: "none" };

  private cachedSelection: SharedWorkspaceRouteSelection = { kind: "none" };

  private cachedSelectionKey = "none";

  private handlePopState = () => {
    this.emit();
  };

  readRouteSelection = (): SharedWorkspaceRouteSelection => {
    const pathSelection = readPathSelectionFromWindow();
    const nextSelection = pathSelection.kind !== "none" ? pathSelection : this.restoreSelection;
    const nextKey = getRouteSelectionKey(nextSelection);
    if (nextKey === this.cachedSelectionKey) {
      return this.cachedSelection;
    }
    this.cachedSelection = nextSelection;
    this.cachedSelectionKey = nextKey;
    return nextSelection;
  };

  subscribeRouteSelection = (listener: RouteListener) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1 && typeof window !== "undefined") {
      window.addEventListener("popstate", this.handlePopState);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && typeof window !== "undefined") {
        window.removeEventListener("popstate", this.handlePopState);
      }
    };
  };

  navigateToWorkspace = (workspaceId: string, options?: WorkspaceNavigationOptions) => {
    commitRouteSelection({ kind: "workspace", workspaceId }, options?.replace === true);
    this.emit();
  };

  navigateToSection = (
    section: SharedWorkspaceShellSection,
    options?: WorkspaceNavigationOptions
  ) => {
    commitRouteSelection({ kind: section }, options?.replace === true);
    this.emit();
  };

  navigateHome = (options?: WorkspaceNavigationOptions) => {
    commitRouteSelection({ kind: "home" }, options?.replace === true);
    this.emit();
  };

  setRestoreWorkspaceId = (workspaceId: string | null) => {
    this.restoreSelection =
      workspaceId === null ? { kind: "home" } : { kind: "workspace", workspaceId };
    this.emit();
  };

  clearRestoreSelection = () => {
    this.restoreSelection = { kind: "none" };
    this.emit();
  };

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const desktopWorkspaceNavigation = new DesktopWorkspaceNavigationAdapter();

export function useWorkspaceRouteSelection() {
  return useSyncExternalStore(
    desktopWorkspaceNavigation.subscribeRouteSelection.bind(desktopWorkspaceNavigation),
    desktopWorkspaceNavigation.readRouteSelection.bind(desktopWorkspaceNavigation),
    desktopWorkspaceNavigation.readRouteSelection.bind(desktopWorkspaceNavigation)
  );
}

export function useDesktopMissionHomeRoute() {
  return useSyncExternalStore(
    desktopWorkspaceNavigation.subscribeRouteSelection.bind(desktopWorkspaceNavigation),
    () => typeof window !== "undefined" && isDesktopMissionHomePath(window.location.pathname),
    () => false
  );
}

export function setWorkspaceRouteRestoreSelection(workspaceId: string | null) {
  desktopWorkspaceNavigation.setRestoreWorkspaceId(workspaceId);
}

export function clearWorkspaceRouteRestoreSelection() {
  desktopWorkspaceNavigation.clearRestoreSelection();
}

export type WorkspaceRouteSelection = SharedWorkspaceRouteSelection;

export function readWorkspaceRouteSelection(pathname: string) {
  if (isDesktopWorkspaceRootAliasPath(pathname)) {
    return { kind: "home" } satisfies SharedWorkspaceRouteSelection;
  }
  if (isDesktopMissionHomePath(pathname)) {
    return { kind: "missions" } satisfies SharedWorkspaceRouteSelection;
  }
  return readSharedWorkspaceRouteSelection(pathname, {
    workspaceBasePath: WORKSPACE_BASE_PATH,
  });
}

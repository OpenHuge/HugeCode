export type SharedWorkspaceShellSection =
  | "home"
  | "workspaces"
  | "missions"
  | "review"
  | "settings";

export type SharedWorkspaceRouteSelection =
  | { kind: "none" }
  | { kind: SharedWorkspaceShellSection }
  | { kind: "workspace"; workspaceId: string };

export type WorkspaceNavigationOptions = {
  replace?: boolean;
};

export type WorkspaceNavigationAdapter = {
  readRouteSelection: () => SharedWorkspaceRouteSelection;
  subscribeRouteSelection: (listener: () => void) => () => void;
  navigateToWorkspace: (
    workspaceId: string,
    options?: WorkspaceNavigationOptions
  ) => void | Promise<void>;
  navigateToSection: (
    section: SharedWorkspaceShellSection,
    options?: WorkspaceNavigationOptions
  ) => void | Promise<void>;
  navigateHome: (options?: WorkspaceNavigationOptions) => void | Promise<void>;
  getAccountCenterHref?: () => string | null;
  navigateToAccountCenter?: (options?: WorkspaceNavigationOptions) => void | Promise<void>;
};

type WorkspaceRoutePathOptions = {
  workspaceBasePath?: string;
};

const SECTION_QUERY_PARAM = "section";

function isSharedWorkspaceShellSection(value: string): value is SharedWorkspaceShellSection {
  return (
    value === "home" ||
    value === "workspaces" ||
    value === "missions" ||
    value === "review" ||
    value === "settings"
  );
}

function parseRouteInput(routeInput: string) {
  return new URL(routeInput || "/", "https://workspace-shell.invalid");
}

function normalizePathname(pathname: string): string {
  if (!pathname) {
    return "/";
  }
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "") || "/";
  }
  return pathname;
}

function normalizeWorkspaceBasePath(workspaceBasePath = "/workspaces"): string {
  const normalized = normalizePathname(workspaceBasePath);
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function readSharedWorkspaceRouteSelection(
  routeInput: string,
  options: WorkspaceRoutePathOptions = {}
): SharedWorkspaceRouteSelection {
  const routeUrl = parseRouteInput(routeInput);
  const normalizedPathname = normalizePathname(routeUrl.pathname);
  const normalizedBasePath = normalizeWorkspaceBasePath(options.workspaceBasePath);

  if (normalizedPathname === normalizedBasePath) {
    const section = routeUrl.searchParams.get(SECTION_QUERY_PARAM);
    if (section && isSharedWorkspaceShellSection(section)) {
      return { kind: section };
    }
    return { kind: "home" };
  }

  if (!normalizedPathname.startsWith(`${normalizedBasePath}/`)) {
    return { kind: "none" };
  }

  const routeWorkspaceId = normalizedPathname.slice(normalizedBasePath.length + 1).trim();
  if (!routeWorkspaceId) {
    return { kind: "home" };
  }

  return {
    kind: "workspace",
    workspaceId: decodeURIComponent(routeWorkspaceId),
  };
}

export function buildSharedWorkspaceRoutePathname(
  selection: SharedWorkspaceRouteSelection,
  options: WorkspaceRoutePathOptions = {}
): string | null {
  const normalizedBasePath = normalizeWorkspaceBasePath(options.workspaceBasePath);

  if (selection.kind === "none") {
    return null;
  }

  if (selection.kind === "home") {
    return normalizedBasePath;
  }

  if (selection.kind !== "workspace") {
    return `${normalizedBasePath}?${SECTION_QUERY_PARAM}=${encodeURIComponent(selection.kind)}`;
  }

  return `${normalizedBasePath}/${encodeURIComponent(selection.workspaceId)}`;
}

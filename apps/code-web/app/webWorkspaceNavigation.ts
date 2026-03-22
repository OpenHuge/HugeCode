import type { AnyRouter } from "@tanstack/react-router";
import type {
  SharedWorkspaceShellSection,
  WorkspaceNavigationAdapter,
} from "@ku0/code-workspace-client/workspace-shell";

function readWorkspaceIdFromSearch(search: unknown): string | null {
  if (!search || typeof search !== "object" || Array.isArray(search)) {
    return null;
  }
  const workspaceId = (search as Record<string, unknown>).workspace;
  return typeof workspaceId === "string" && workspaceId.trim().length > 0 ? workspaceId : null;
}

function readSectionFromSearch(search: unknown): SharedWorkspaceShellSection {
  if (!search || typeof search !== "object" || Array.isArray(search)) {
    return "home";
  }
  const section = (search as Record<string, unknown>).section;
  if (
    section === "home" ||
    section === "workspaces" ||
    section === "missions" ||
    section === "review" ||
    section === "settings"
  ) {
    return section;
  }
  return "home";
}

function getRouteSelectionKey(
  selection: ReturnType<WorkspaceNavigationAdapter["readRouteSelection"]>
) {
  if (selection.kind !== "workspace") {
    return selection.kind;
  }
  return `workspace:${selection.workspaceId}`;
}

export function createTanStackWorkspaceNavigationAdapter(
  getRouter: () => AnyRouter
): WorkspaceNavigationAdapter {
  let cachedSelection = { kind: "none" } as ReturnType<
    WorkspaceNavigationAdapter["readRouteSelection"]
  >;
  let cachedSelectionKey = "none";

  return {
    readRouteSelection: () => {
      const router = getRouter();
      const { pathname, search } = router.state.location;
      const nextSelection =
        pathname !== "/app"
          ? ({ kind: "none" } as const)
          : (() => {
              const workspaceId = readWorkspaceIdFromSearch(search);
              if (!workspaceId) {
                return { kind: readSectionFromSearch(search) } as const;
              }
              return { kind: "workspace", workspaceId } as const;
            })();
      const nextKey = getRouteSelectionKey(nextSelection);
      if (nextKey === cachedSelectionKey) {
        return cachedSelection;
      }
      cachedSelection = nextSelection;
      cachedSelectionKey = nextKey;
      return nextSelection;
    },
    subscribeRouteSelection: (listener) => getRouter().subscribe("onResolved", listener),
    navigateToWorkspace: (workspaceId, options) =>
      getRouter().navigate({
        to: "/app",
        search: {
          workspace: workspaceId,
        } as never,
        replace: options?.replace,
      }),
    navigateToSection: (section, options) =>
      getRouter().navigate({
        to: "/app",
        search:
          section === "home"
            ? ({} as never)
            : ({
                section,
              } as never),
        replace: options?.replace,
      }),
    navigateHome: (options) =>
      getRouter().navigate({
        to: "/app",
        search: {} as never,
        replace: options?.replace,
      }),
    getAccountCenterHref: () => "/account",
    navigateToAccountCenter: (options) =>
      getRouter().navigate({
        to: "/account",
        replace: options?.replace,
      }),
  };
}

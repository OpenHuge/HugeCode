import { createRouter as createTanStackRouter, type AnyRouter } from "@tanstack/react-router";
import { createWebWorkspaceClientBindings } from "./components/createWebWorkspaceClientBindings";
import { routeTree } from "./routeTree.gen";
import { createTanStackWorkspaceNavigationAdapter } from "./webWorkspaceNavigation";

export function getRouter() {
  let routerRef: AnyRouter | null = null;
  const navigation = createTanStackWorkspaceNavigationAdapter(() => {
    if (!routerRef) {
      throw new Error("Web router navigation adapter was read before router initialization.");
    }
    return routerRef;
  });
  const workspaceBindings = createWebWorkspaceClientBindings(navigation);
  const router = createTanStackRouter({
    routeTree,
    context: {
      workspaceBindings,
    },
    defaultPreload: "intent",
    scrollRestoration: true,
  });
  routerRef = router;
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

import type { HugeRouterCommercialServiceSnapshot } from "@ku0/code-runtime-host-contract/codeRuntimeRpc";
import type { HugeCodeRuntimeBridge } from "@ku0/code-t3-runtime-adapter";
import { useEffect, useMemo, useState } from "react";
import {
  buildT3HugeRouterCommercialServiceSnapshotMock,
  createT3HugeRouterRouteTokenFixtureRoute,
  T3_HUGEROUTER_ROUTE_TOKEN_ENV_KEY,
} from "../runtime/t3HugeRouterCommercial";
import {
  listT3AiGatewayRoutesMock,
  type T3AiGatewayRoute,
  type T3HugerouterCapacityListing,
  type T3HugerouterCapacityOrder,
} from "../runtime/t3BrowserProfiles";

export type UseT3HugeRouterCommercialServiceInput = {
  aiGatewayConcurrency: string;
  aiGatewayDailyBudget: string;
  aiGatewayOwnerLabel: string;
  aiGatewayRoutes: readonly T3AiGatewayRoute[];
  hugerouterListings: readonly T3HugerouterCapacityListing[];
  hugerouterOrders: readonly T3HugerouterCapacityOrder[];
  onAiGatewayRoutesChanged: (routes: T3AiGatewayRoute[]) => void;
  onNotice: (notice: string) => void;
  refreshRoutes: () => Promise<void>;
  runtimeBridge: HugeCodeRuntimeBridge;
  workspaceId: string;
};

export function useT3HugeRouterCommercialService({
  aiGatewayConcurrency,
  aiGatewayDailyBudget,
  aiGatewayOwnerLabel,
  aiGatewayRoutes,
  hugerouterListings,
  hugerouterOrders,
  onAiGatewayRoutesChanged,
  onNotice,
  refreshRoutes,
  runtimeBridge,
  workspaceId,
}: UseT3HugeRouterCommercialServiceInput) {
  const [runtimeSnapshot, setRuntimeSnapshot] =
    useState<HugeRouterCommercialServiceSnapshot | null>(null);
  const fixtureSnapshot = useMemo(
    () =>
      buildT3HugeRouterCommercialServiceSnapshotMock({
        listings: hugerouterListings,
        orders: hugerouterOrders,
        routes: aiGatewayRoutes,
      }),
    [aiGatewayRoutes, hugerouterListings, hugerouterOrders]
  );
  const snapshot = runtimeSnapshot ?? fixtureSnapshot;

  useEffect(() => {
    if (!runtimeBridge.readHugeRouterCommercialService) {
      return;
    }
    void runtimeBridge
      .readHugeRouterCommercialService()
      .then((nextSnapshot) => setRuntimeSnapshot(nextSnapshot))
      .catch(() => setRuntimeSnapshot(null));
  }, [runtimeBridge]);

  async function issueRouteToken() {
    try {
      if (runtimeBridge.issueHugeRouterRouteToken) {
        const response = await runtimeBridge.issueHugeRouterRouteToken({
          envKey: T3_HUGEROUTER_ROUTE_TOKEN_ENV_KEY,
          projectId: snapshot.connection.projectId,
          scopes: [
            "route:codex",
            "route:claude",
            "provider:any-relay",
            "provider:hugerouter-commercial",
          ],
          ttlSeconds: 86_400,
          workspaceId,
        });
        const refreshedSnapshot =
          (await runtimeBridge.readHugeRouterCommercialService?.()) ??
          ({
            ...snapshot,
            routeToken: response.summary,
          } satisfies HugeRouterCommercialServiceSnapshot);
        if (response.token === "dev_hugerouter_route_token_redacted") {
          createT3HugeRouterRouteTokenFixtureRoute({
            maxConcurrentTasks: Number(aiGatewayConcurrency),
            ownerLabel: aiGatewayOwnerLabel,
            requestBudgetPerDay: Number(aiGatewayDailyBudget),
          });
          onAiGatewayRoutesChanged(listT3AiGatewayRoutesMock());
        }
        setRuntimeSnapshot(refreshedSnapshot);
        await refreshRoutes();
        onNotice(
          `HugeRouter route token ${response.summary.envKey} is active; token material stays in HugeRouter/runtime custody.`
        );
        return;
      }
      const route = createT3HugeRouterRouteTokenFixtureRoute({
        maxConcurrentTasks: Number(aiGatewayConcurrency),
        ownerLabel: aiGatewayOwnerLabel,
        requestBudgetPerDay: Number(aiGatewayDailyBudget),
      });
      onAiGatewayRoutesChanged(listT3AiGatewayRoutesMock());
      onNotice(
        `${route.planLabel} route token fixture is active as ${T3_HUGEROUTER_ROUTE_TOKEN_ENV_KEY}; token material stays outside T3 persisted state.`
      );
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to issue HugeRouter route token.");
    }
  }

  return {
    issueRouteToken,
    snapshot,
  };
}

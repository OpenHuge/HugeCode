import type { HugeRouterCommercialServiceSnapshot } from "@ku0/code-runtime-host-contract/codeRuntimeRpc";
import {
  createT3AiGatewayRouteMock,
  listT3AiGatewayRoutesMock,
  listT3HugerouterCapacityListingsMock,
  listT3HugerouterCapacityOrdersMock,
  T3_HUGEROUTER_MEMBERSHIP_TIER_OPTIONS,
  type T3AiGatewayRoute,
  type T3HugerouterCapacityListing,
  type T3HugerouterCapacityOrder,
} from "./t3BrowserProfiles";

export type BuildT3HugeRouterCommercialServiceSnapshotInput = {
  routes?: readonly T3AiGatewayRoute[];
  listings?: readonly T3HugerouterCapacityListing[];
  orders?: readonly T3HugerouterCapacityOrder[];
};

export const T3_HUGEROUTER_ROUTE_TOKEN_ENV_KEY = "HUGEROUTER_ROUTE_TOKEN";
export const T3_HUGEROUTER_ROUTE_BASE_URL = "https://hugerouter.openhuge.local/v1";

export function buildT3HugeRouterCommercialServiceSnapshotMock(
  input: BuildT3HugeRouterCommercialServiceSnapshotInput = {}
): HugeRouterCommercialServiceSnapshot {
  const routes = input.routes ?? listT3AiGatewayRoutesMock();
  const listings = input.listings ?? listT3HugerouterCapacityListingsMock();
  const orders = input.orders ?? listT3HugerouterCapacityOrdersMock();
  const activeOrder = orders.find((order) => order.status !== "refunded") ?? null;
  const routableRoutes = routes.filter(
    (route) => route.providerId === "hugerouter" && route.routable
  );
  const includedMonthlyCredits =
    listings.reduce((total, listing) => total + listing.totalCredits, 0) || 1_000_000;
  const remainingCredits =
    listings.reduce((total, listing) => total + listing.availableCredits, 0) ||
    includedMonthlyCredits;
  const primaryListing = listings[0] ?? null;

  return {
    availablePlans: Object.entries(T3_HUGEROUTER_MEMBERSHIP_TIER_OPTIONS).map(([tier, option]) => ({
      capacityKind: tier === "hugerouter-scale" ? "reserved" : "included",
      currency: "USD",
      description:
        "Official HugeRouter commercial capacity. HugeCode exposes only typed connection, capacity, plan, order, and route-token state.",
      includedMonthlyCredits: option.includedCredits,
      name: option.label,
      orderUrl: `https://hugerouter.openhuge.local/orders/new?plan=${tier}`,
      planId: tier,
      unitPriceLabel: option.multiplier,
    })),
    capacity: {
      burstCapacityEligible: true,
      capacityKind:
        primaryListing?.sourceKind === "provider-authorized-pool" ? "external_relay" : "reserved",
      concurrencyLimit:
        routableRoutes.reduce((total, route) => total + route.maxConcurrentTasks, 0) || 4,
      includedMonthlyCredits,
      planId: primaryListing?.tier ?? "hugerouter-pro",
      planName: primaryListing?.tierLabel ?? "Hugerouter Pro",
      remainingCredits,
      resetsAt: null,
      sharedCapacityEligible: true,
    },
    connection: {
      accountLabel: "T3 workspace commercial route",
      dashboardUrl: "https://hugerouter.openhuge.local/dashboard",
      diagnostics: [
        "HugeCode owns typed UI and runtime contract state.",
        "HugeRouter owns merchant, metering, settlement, route receipts, and route decisions.",
      ],
      projectId: "t3code-local",
      routeBaseUrl: T3_HUGEROUTER_ROUTE_BASE_URL,
      status: "connected",
      tenantId: "openhuge-local",
    },
    order: activeOrder
      ? {
          checkoutUrl: "https://hugerouter.openhuge.local/orders",
          manageUrl: "https://hugerouter.openhuge.local/orders",
          nextBillingAt: null,
          orderId: activeOrder.id,
          planId: primaryListing?.tier ?? "hugerouter-pro",
          status: activeOrder.status === "settled" ? "active" : "pending_payment",
        }
      : {
          checkoutUrl: "https://hugerouter.openhuge.local/orders/new?plan=hugerouter-pro",
          manageUrl: "https://hugerouter.openhuge.local/orders",
          nextBillingAt: null,
          orderId: null,
          planId: "hugerouter-pro",
          status: "none",
        },
    routeToken: {
      envKey: T3_HUGEROUTER_ROUTE_TOKEN_ENV_KEY,
      expiresAt: null,
      lastFour: routableRoutes.length > 0 ? "t3v1" : null,
      lastIssuedAt: routableRoutes[0]?.createdAt ?? null,
      scopes: [
        "route:codex",
        "route:claude",
        "provider:any-relay",
        "provider:hugerouter-commercial",
      ],
      status: routableRoutes.length > 0 ? "active" : "not_issued",
      tokenId: routableRoutes.length > 0 ? `route-token:${routableRoutes[0]!.id}` : null,
    },
  };
}

export function createT3HugeRouterRouteTokenFixtureRoute(input: {
  maxConcurrentTasks: number;
  ownerLabel: string;
  requestBudgetPerDay: number;
}) {
  return createT3AiGatewayRouteMock({
    maxConcurrentTasks: Math.max(input.maxConcurrentTasks || 4, 1),
    ownerLabel: input.ownerLabel || "T3 workspace",
    planType: "hugerouter-pro",
    requestBudgetPerDay: Math.max(input.requestBudgetPerDay || 500, 1),
    routeMode: "official-api",
  });
}

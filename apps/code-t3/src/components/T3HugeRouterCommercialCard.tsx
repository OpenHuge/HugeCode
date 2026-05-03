import type { HugeRouterCommercialServiceSnapshot } from "@ku0/code-runtime-host-contract/codeRuntimeRpc";
import { ShieldCheck } from "lucide-react";

export type T3HugeRouterCommercialCardProps = {
  snapshot: HugeRouterCommercialServiceSnapshot;
  onIssueRouteToken: () => void;
};

function formatCredits(credits: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(credits);
}

export function T3HugeRouterCommercialCard({
  snapshot,
  onIssueRouteToken,
}: T3HugeRouterCommercialCardProps) {
  return (
    <div className="t3-hugerouter-commercial" aria-label="HugeRouter commercial service">
      <header>
        <span>
          <ShieldCheck size={13} />
          HugeRouter Commercial
        </span>
        <em>{snapshot.connection.status}</em>
      </header>
      <div className="t3-hugerouter-commercial-stats">
        <span>{snapshot.capacity?.planName ?? snapshot.availablePlans[0]?.name ?? "No plan"}</span>
        <span>{formatCredits(snapshot.capacity?.remainingCredits ?? 0)} credits</span>
        <span>{snapshot.routeToken?.status ?? "not_issued"}</span>
      </div>
      <small>
        Official V1 launch route. T3/HugeCode keeps typed connection, capacity, plan, order, and
        route-token state; HugeRouter owns merchant, metering, settlement, route receipts, and route
        decisions.
      </small>
      <div className="t3-hugerouter-commercial-stats">
        <span>{snapshot.connection.routeBaseUrl}</span>
        <span>{snapshot.routeToken?.envKey}</span>
        <span>{snapshot.order?.status ?? "none"}</span>
      </div>
      <button type="button" onClick={onIssueRouteToken}>
        Issue route token
      </button>
    </div>
  );
}

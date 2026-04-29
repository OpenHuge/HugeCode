import { Button } from "@ku0/design-system";
import { SettingsField, SettingsFieldGroup, SettingsFooterBar } from "./SettingsSectionGrammar";
import {
  createSettingsServerOperabilityState,
  resolveSettingsServerOperabilityNotice,
  type SettingsHugeRouterCommercialSurface,
} from "./serverControlPlaneTypes";

export type SettingsHugeRouterCommercialSectionProps = {
  surface?: SettingsHugeRouterCommercialSurface | null;
};

function formatTimestamp(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not recorded";
  }
  return new Date(value).toLocaleString();
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not reported";
  }
  return new Intl.NumberFormat().format(value);
}

function formatBoolean(value: boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not reported";
  }
  return value ? "Eligible" : "Not eligible";
}

function formatConnectionStatus(surface: SettingsHugeRouterCommercialSurface | null | undefined) {
  const connection = surface?.snapshot?.connection ?? null;
  if (!connection) {
    return {
      status: "not_connected",
      label: "Not connected",
      details: "HugeRouter commercial service is not connected for this workspace.",
    };
  }
  const account = connection.accountLabel ?? connection.projectId ?? connection.tenantId;
  return {
    status: connection.status,
    label: account ? `${connection.status} (${account})` : connection.status,
    details:
      connection.routeBaseUrl ?? connection.dashboardUrl ?? "HugeRouter has not published a URL.",
  };
}

function formatPlanSummary(
  surface: SettingsHugeRouterCommercialSurface | null | undefined
): string {
  const plans = surface?.snapshot?.availablePlans ?? [];
  if (plans.length === 0) {
    return "No commercial plans loaded from HugeRouter.";
  }
  return plans
    .slice(0, 3)
    .map((plan) => `${plan.name} (${plan.capacityKind})`)
    .join(" | ");
}

export function SettingsHugeRouterCommercialSection({
  surface,
}: SettingsHugeRouterCommercialSectionProps) {
  const snapshot = surface?.snapshot ?? null;
  const operability = surface?.operability ?? createSettingsServerOperabilityState();
  const notice = resolveSettingsServerOperabilityNotice(operability);
  const connection = formatConnectionStatus(surface);
  const capacity = snapshot?.capacity ?? null;
  const order = snapshot?.order ?? null;
  const routeToken = snapshot?.routeToken ?? null;
  const actionBlocked =
    operability.loading ||
    Boolean(operability.error ?? operability.readOnlyReason ?? operability.unavailableReason);
  const connected = connection.status === "connected" || connection.status === "action_required";

  return (
    <SettingsFieldGroup
      title="HugeRouter commercial route"
      subtitle="Connect the official HugeRouter launch path here. HugeCode keeps typed connection, capacity, plan, order, and route-token state; HugeRouter remains the source of truth for merchant, metering, settlement, and route receipts."
    >
      <SettingsField
        label="Commercial connection"
        help="Connection identity and gateway URL come from HugeRouter, not from local relay inference."
      >
        <div>
          <div>Status: {connection.label}</div>
          <div>Gateway: {connection.details}</div>
        </div>
      </SettingsField>

      <SettingsField
        label="Capacity and plans"
        help="Capacity reflects HugeRouter-published entitlement state. HugeCode only displays the summary."
      >
        <div>
          <div>
            Current plan: {capacity?.planName ?? "Not selected"} /{" "}
            {capacity?.capacityKind ?? "not reported"}
          </div>
          <div>
            Remaining credits: {formatNumber(capacity?.remainingCredits)}; concurrency:{" "}
            {formatNumber(capacity?.concurrencyLimit)}
          </div>
          <div>
            Shared capacity: {formatBoolean(capacity?.sharedCapacityEligible)}; burst capacity:{" "}
            {formatBoolean(capacity?.burstCapacityEligible)}
          </div>
          <div>Available plans: {formatPlanSummary(surface)}</div>
        </div>
      </SettingsField>

      <SettingsField
        label="Order"
        help="Checkout, renewal, and plan management stay on HugeRouter-owned merchant surfaces."
      >
        <div>
          <div>Status: {order?.status ?? "none"}</div>
          <div>Order: {order?.orderId ?? "Not recorded"}</div>
          <div>Next billing: {formatTimestamp(order?.nextBillingAt)}</div>
        </div>
      </SettingsField>

      <SettingsField
        label="Route token"
        help="Route tokens are passed to Codex through an environment variable and must not be persisted in Codex config."
      >
        <div>
          <div>
            Status: {routeToken?.status ?? "not_issued"}; env:{" "}
            {routeToken?.envKey ?? "HUGEROUTER_ROUTE_TOKEN"}
          </div>
          <div>Token: {routeToken?.lastFour ? `ending ${routeToken.lastFour}` : "Not issued"}</div>
          <div>Expires: {formatTimestamp(routeToken?.expiresAt)}</div>
        </div>
      </SettingsField>

      {snapshot?.connection.diagnostics.map((diagnostic) => (
        <div key={diagnostic} className="settings-help">
          {diagnostic}
        </div>
      ))}
      {notice ? (
        <div
          className={
            notice.tone === "error" ? "settings-help settings-help-error" : "settings-help"
          }
        >
          {notice.text}
        </div>
      ) : null}

      <SettingsFooterBar>
        <Button
          variant="secondary"
          size="sm"
          disabled={actionBlocked || !surface?.onConnect}
          onClick={() => {
            void surface?.onConnect?.();
          }}
        >
          Connect HugeRouter
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={operability.loading || !surface?.onRefresh}
          onClick={() => {
            void surface?.onRefresh?.();
          }}
        >
          Refresh
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={actionBlocked || !surface?.onOpenPlans}
          onClick={() => {
            void surface?.onOpenPlans?.();
          }}
        >
          View plans
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={actionBlocked || !surface?.onOpenOrders}
          onClick={() => {
            void surface?.onOpenOrders?.();
          }}
        >
          View orders
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={actionBlocked || !connected || !surface?.onIssueRouteToken}
          onClick={() => {
            void surface?.onIssueRouteToken?.();
          }}
        >
          Issue route token
        </Button>
      </SettingsFooterBar>
    </SettingsFieldGroup>
  );
}

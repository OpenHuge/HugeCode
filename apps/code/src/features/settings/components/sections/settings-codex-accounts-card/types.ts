import type { OAuthAccountSummary } from "../../../../../application/runtime/ports/tauriOauth";
import type { ProviderBrandId } from "../../../../app/utils/antiGravityBranding";

export type AccountPoolsTab = "accounts" | "pools" | "health";

export type FormBusyAction =
  | null
  | "refresh"
  | "add-account"
  | "import-cockpit-tools"
  | "add-pool"
  | "bulk-enable"
  | "bulk-disable"
  | "bulk-remove"
  | "bulk-enable-pools"
  | "bulk-disable-pools"
  | "bulk-remove-pools"
  | "bulk-update-pool-sticky"
  | `remove-account:${string}`
  | `remove-pool:${string}`
  | `probe-pool:${string}`
  | `report-rate-limit:${string}`
  | `clear-rate-limit:${string}`
  | `reauth-account:${string}`
  | `review-account-deactive-workspaces:${string}`
  | `leave-account-deactive-workspaces:${string}`
  | `save-pool:${string}`
  | `set-account-default-workspace:${string}`
  | `sync-pool:${string}`
  | `toggle-account:${string}`;

export type ProviderFilter = "all" | ProviderBrandId;
export type AccountStatusFilter = "all" | OAuthAccountSummary["status"];

export type PoolSelectionPreview = {
  accountId: string;
  reason: string;
  selectedAt: number;
};

export type PoolSaveStatus = "idle" | "dirty" | "saving" | "error" | "conflict";

export type PoolSaveState = {
  status: PoolSaveStatus;
  code?: string | null;
  message: string | null;
};

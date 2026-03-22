import type {
  OAuthAccountSummary,
  OAuthPoolSummary,
  RuntimeProviderCatalogEntry,
} from "@ku0/code-runtime-host-contract";
import type { OAuthProviderId } from "../ports/tauriOauth";

export type RuntimeRoutingProviderDescriptor = {
  providerId: OAuthProviderId;
  label: string;
  available: boolean;
};

export type RuntimeProviderRoutingHealth = {
  providerId: OAuthProviderId;
  providerLabel: string;
  poolRoutingReady: boolean;
  recommendation: string | null;
  accountsTotal: number;
  enabledAccounts: number;
  credentialReadyAccounts: number;
  poolsTotal: number;
  enabledPools: number;
};

export type RuntimeProviderRoutingHealthEntry = RuntimeProviderRoutingHealth;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function hasRuntimeRoutingCredential(account: OAuthAccountSummary): boolean {
  if (account.routingState?.credentialReady === true) {
    return true;
  }
  const metadata = account.metadata;
  if (!isRecord(metadata)) {
    return false;
  }
  if (metadata.apiKeyConfigured === true) {
    return true;
  }
  return (
    metadata.localCliManaged === true &&
    metadata.source === "local_codex_cli_auth" &&
    metadata.credentialAvailable === true
  );
}

type BuildRuntimeProviderRoutingHealthOptions = {
  providers: ReadonlyArray<RuntimeRoutingProviderDescriptor | RuntimeProviderCatalogEntry>;
  accounts: ReadonlyArray<OAuthAccountSummary>;
  pools: ReadonlyArray<OAuthPoolSummary>;
};

function normalizeProviderDescriptor(
  provider: RuntimeRoutingProviderDescriptor | RuntimeProviderCatalogEntry
): RuntimeRoutingProviderDescriptor | null {
  if ("oauthProviderId" in provider) {
    const providerId = provider.oauthProviderId;
    if (!providerId) {
      return null;
    }
    return {
      providerId,
      label: provider.displayName,
      available: provider.available,
    };
  }
  return provider;
}

export function buildRuntimeProviderRoutingHealth({
  providers,
  accounts,
  pools,
}: BuildRuntimeProviderRoutingHealthOptions): RuntimeProviderRoutingHealth[] {
  return providers
    .map(normalizeProviderDescriptor)
    .filter((provider): provider is RuntimeRoutingProviderDescriptor => provider !== null)
    .map((provider) => {
      const providerAccounts = accounts.filter(
        (account) => account.provider === provider.providerId
      );
      const enabledAccounts = providerAccounts.filter(
        (account) => account.status === "enabled" && account.routeConfig?.schedulable !== false
      );
      const credentialReadyAccounts = enabledAccounts.filter(hasRuntimeRoutingCredential);
      const providerPools = pools.filter((pool) => pool.provider === provider.providerId);
      const enabledPools = providerPools.filter((pool) => pool.enabled);
      const poolRoutingReady = enabledPools.length > 0 && credentialReadyAccounts.length > 0;

      let recommendation: string | null = null;
      if (!provider.available) {
        recommendation = "Runtime provider catalog currently marks this provider unavailable.";
      } else if (enabledPools.length === 0) {
        recommendation = "Enable at least one pool for this provider.";
      } else if (enabledAccounts.length === 0) {
        recommendation = "Enable at least one account for this provider.";
      } else if (credentialReadyAccounts.length === 0) {
        recommendation = "Sign in or configure credentials for at least one enabled account.";
      }

      return {
        providerId: provider.providerId,
        providerLabel: provider.label,
        poolRoutingReady,
        recommendation,
        accountsTotal: providerAccounts.length,
        enabledAccounts: enabledAccounts.length,
        credentialReadyAccounts: credentialReadyAccounts.length,
        poolsTotal: providerPools.length,
        enabledPools: enabledPools.length,
      };
    });
}

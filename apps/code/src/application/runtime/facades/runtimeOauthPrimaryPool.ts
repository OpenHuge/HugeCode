import type { OAuthProviderId } from "../ports/runtimeClient";

const PRIMARY_POOL_ID_BY_PROVIDER: Partial<Record<OAuthProviderId, string>> = {
  codex: "pool-codex",
  gemini: "pool-gemini",
  claude_code: "pool-claude",
};

const PRIMARY_POOL_NAME_BY_PROVIDER: Partial<Record<OAuthProviderId, string>> = {
  codex: "Codex Pool",
  gemini: "Gemini Pool",
  claude_code: "Claude Pool",
};

export function getDefaultPrimaryPoolIdForProvider(provider: OAuthProviderId): string {
  return PRIMARY_POOL_ID_BY_PROVIDER[provider] ?? `pool-${provider}`;
}

export function getDefaultPrimaryPoolNameForProvider(provider: OAuthProviderId): string {
  return PRIMARY_POOL_NAME_BY_PROVIDER[provider] ?? "OAuth Pool";
}

export function isDefaultPrimaryPoolForProvider(input: {
  provider: OAuthProviderId;
  poolId: string;
}): boolean {
  return input.poolId === getDefaultPrimaryPoolIdForProvider(input.provider);
}

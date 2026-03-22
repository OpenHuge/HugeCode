import type { OAuthPoolSummary } from "../../../../../application/runtime/ports/tauriOauth";
import {
  getDefaultPrimaryPoolIdForProvider,
  isDefaultPrimaryPoolForProvider,
} from "../../../../../application/runtime/facades/runtimeOauthPrimaryPool";

export const CODEX_PRIMARY_POOL_ID = getDefaultPrimaryPoolIdForProvider("codex");

export function isCodexPrimaryPool(pool: Pick<OAuthPoolSummary, "poolId" | "provider">): boolean {
  return isDefaultPrimaryPoolForProvider({ provider: pool.provider, poolId: pool.poolId });
}

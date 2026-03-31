import type { OAuthAccountSummary } from "../../../../../application/runtime/ports/oauth";
import {
  accountHasServiceCodexOauthSource,
  maxCodexAccountTimestamp,
  OAUTH_ACCOUNT_SYNC_POLL_INTERVAL_MS,
  OAUTH_ACCOUNT_SYNC_TIMEOUT_MS,
} from "./oauthHelpers";

type WaitForCodexOauthBindingDeps = {
  getAccountInfo(workspaceId: string): Promise<unknown>;
  readCodexAccountsForOauthSync(): Promise<OAuthAccountSummary[]>;
  isMounted?(): boolean;
};

function readWorkspaceBindingVerifiedPayload(accountInfo: unknown): boolean {
  if (!accountInfo || typeof accountInfo !== "object" || Array.isArray(accountInfo)) {
    return false;
  }
  const accountInfoRecord = accountInfo as Record<string, unknown>;
  const result =
    accountInfoRecord.result &&
    typeof accountInfoRecord.result === "object" &&
    !Array.isArray(accountInfoRecord.result)
      ? (accountInfoRecord.result as Record<string, unknown>)
      : accountInfoRecord;
  return (result.requiresOpenaiAuth ?? result.requires_openai_auth) === false;
}

export async function readWorkspaceBindingVerified(
  deps: Pick<WaitForCodexOauthBindingDeps, "getAccountInfo">,
  workspaceId: string
): Promise<boolean> {
  const accountInfo = await deps.getAccountInfo(workspaceId).catch(() => null);
  return readWorkspaceBindingVerifiedPayload(accountInfo);
}

export async function waitForCodexOauthBinding(
  deps: WaitForCodexOauthBindingDeps,
  workspaceId: string,
  baselineUpdatedAt: number
): Promise<boolean> {
  const deadline = Date.now() + OAUTH_ACCOUNT_SYNC_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, OAUTH_ACCOUNT_SYNC_POLL_INTERVAL_MS));
    if (await readWorkspaceBindingVerified(deps, workspaceId)) {
      return true;
    }
    const latestAccounts = await deps.readCodexAccountsForOauthSync().catch(() => []);
    if (deps.isMounted && !deps.isMounted()) {
      return false;
    }
    const hasServiceOauthAccount = latestAccounts.some(accountHasServiceCodexOauthSource);
    const latestUpdatedAt = maxCodexAccountTimestamp(latestAccounts);
    if (hasServiceOauthAccount || latestUpdatedAt > baselineUpdatedAt) {
      if (await readWorkspaceBindingVerified(deps, workspaceId)) {
        return true;
      }
    }
  }
  return false;
}

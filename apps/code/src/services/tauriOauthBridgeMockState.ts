import type { OAuthAccountSummary, OAuthPoolMember, OAuthPoolSummary } from "./runtimeClient";
import {
  cloneMockOAuthAccount,
  cloneMockOAuthPool,
  cloneMockOAuthPoolMembersByPoolId,
} from "./tauriOauthBridgeNormalization";

const mockOauthSessionFallbackState: {
  accounts: OAuthAccountSummary[];
  pools: OAuthPoolSummary[];
  poolMembersByPoolId: Record<string, OAuthPoolMember[]>;
  projectWorkspaceBindings: Record<string, string>;
} = {
  accounts: [],
  pools: [],
  poolMembersByPoolId: {},
  projectWorkspaceBindings: {},
};

let mockOauthFallbackActive = false;

function markMockOauthFallbackActive() {
  mockOauthFallbackActive = true;
}

export function clearMockOauthFallbackActive() {
  mockOauthFallbackActive = false;
}

export function isMockOauthFallbackActive() {
  return mockOauthFallbackActive;
}

export function resetMockOauthSessionFallbackState() {
  mockOauthSessionFallbackState.accounts = [];
  mockOauthSessionFallbackState.pools = [];
  mockOauthSessionFallbackState.poolMembersByPoolId = {};
  mockOauthSessionFallbackState.projectWorkspaceBindings = {};
  mockOauthFallbackActive = false;
}

export function readMockOAuthAccounts(): OAuthAccountSummary[] {
  markMockOauthFallbackActive();
  return mockOauthSessionFallbackState.accounts.map(cloneMockOAuthAccount);
}

export function writeMockOAuthAccounts(accounts: OAuthAccountSummary[]) {
  markMockOauthFallbackActive();
  mockOauthSessionFallbackState.accounts = accounts.map(cloneMockOAuthAccount);
}

export function readMockOAuthPools(): OAuthPoolSummary[] {
  markMockOauthFallbackActive();
  return mockOauthSessionFallbackState.pools.map(cloneMockOAuthPool);
}

export function writeMockOAuthPools(pools: OAuthPoolSummary[]) {
  markMockOauthFallbackActive();
  mockOauthSessionFallbackState.pools = pools.map(cloneMockOAuthPool);
}

export function readMockOAuthPoolMembers(): Record<string, OAuthPoolMember[]> {
  markMockOauthFallbackActive();
  return cloneMockOAuthPoolMembersByPoolId(mockOauthSessionFallbackState.poolMembersByPoolId);
}

export function writeMockOAuthPoolMembers(poolMembersByPoolId: Record<string, OAuthPoolMember[]>) {
  markMockOauthFallbackActive();
  mockOauthSessionFallbackState.poolMembersByPoolId =
    cloneMockOAuthPoolMembersByPoolId(poolMembersByPoolId);
}

export function readMockProjectWorkspaceBindings(): Record<string, string> {
  markMockOauthFallbackActive();
  return { ...mockOauthSessionFallbackState.projectWorkspaceBindings };
}

export function writeMockProjectWorkspaceBindings(bindings: Record<string, string>) {
  markMockOauthFallbackActive();
  mockOauthSessionFallbackState.projectWorkspaceBindings = { ...bindings };
}

import type { T3CodeProviderKind } from "@ku0/code-t3-runtime-adapter";
import type { T3BrowserProvider } from "../runtime/t3BrowserProfiles";

export type T3ComposerAccessModeLabel = "read-only" | "on-request" | "full-access";

export function formatSeatPrice(cents: number) {
  return new Intl.NumberFormat(undefined, {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

export function formatCredits(credits: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(credits);
}

export function formatBrowserSyncTime(value: number | null) {
  if (value === null) {
    return "Never";
  }
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function formatGuestPassExpiry(expiresAt: number) {
  return formatBrowserSyncTime(expiresAt);
}

export function browserProviderTitle(provider: T3BrowserProvider) {
  if (provider === "chatgpt") {
    return "ChatGPT";
  }
  if (provider === "gemini") {
    return "Gemini";
  }
  if (provider === "hugerouter") {
    return "Hugerouter";
  }
  return "Custom URL";
}

export function providerTitle(provider: T3CodeProviderKind) {
  return provider === "codex" ? "Codex CLI" : "Claude Code CLI";
}

export function accessModeTitle(mode: T3ComposerAccessModeLabel) {
  if (mode === "read-only") {
    return "Read-only";
  }
  return mode === "full-access" ? "Full access" : "Supervised";
}

import type { T3CodeProviderKind } from "@ku0/code-t3-runtime-adapter";
import type { T3BrowserProvider } from "../runtime/t3BrowserProfiles";

export type T3ComposerAccessModeLabel = "on-request" | "full-access";

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
  return mode === "full-access" ? "Autonomous" : "Supervised";
}

import { type GlobalStyleRule, globalStyle } from "@vanilla-extract/css";

export function applyGlobalStyle(selector: string, rule: Record<string, unknown>) {
  globalStyle(selector, rule as GlobalStyleRule);
}

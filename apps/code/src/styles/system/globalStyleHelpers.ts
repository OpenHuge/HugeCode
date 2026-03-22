import { type GlobalStyleRule, globalStyle } from "@vanilla-extract/css";

type GlobalStyleInput = Record<string, unknown>;

export function applyGlobalStyle(selector: string, rule: GlobalStyleInput) {
  globalStyle(selector, rule as unknown as GlobalStyleRule);
}

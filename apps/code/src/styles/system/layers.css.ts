import { globalLayer } from "@vanilla-extract/css";

export const layers = {
  reset: globalLayer("reset"),
  tokens: globalLayer("tokens"),
  components: globalLayer("components"),
  features: globalLayer("features"),
  utilities: globalLayer("utilities"),
  overrides: globalLayer("overrides"),
} as const;

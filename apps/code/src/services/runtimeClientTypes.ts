import type { AppSettings } from "../types";

/**
 * Compatibility shim. Canonical runtime-client types now live in
 * `@ku0/code-runtime-client/runtimeClientTypes`.
 */
export type {
  RuntimeCapabilitiesSummary,
  RuntimeClientMode,
} from "@ku0/code-runtime-client/runtimeClientTypes";

export type { RuntimeClient as SharedRuntimeClient } from "@ku0/code-runtime-client/runtimeClientTypes";

export type RuntimeClient =
  import("@ku0/code-runtime-client/runtimeClientTypes").RuntimeClient<AppSettings>;

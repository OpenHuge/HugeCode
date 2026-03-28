import { describe, expect, it } from "vitest";
import { AGENT_RUNTIME_CONTROL_TOOL_NAMES } from "./webMcpBridgeToolNames";

describe("@ku0/code-runtime-webmcp-client tool names", () => {
  it("publishes the canonical runtime extension and registry tool names expected by app composition", () => {
    expect(AGENT_RUNTIME_CONTROL_TOOL_NAMES).toEqual(
      expect.arrayContaining([
        "get-runtime-extension",
        "update-runtime-extension",
        "set-runtime-extension-state",
        "search-runtime-extension-registry",
        "list-runtime-extension-registry-sources",
        "evaluate-runtime-extension-permissions",
        "get-runtime-extension-health",
      ])
    );
  });
});

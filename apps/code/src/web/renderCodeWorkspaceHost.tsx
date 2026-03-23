import { createWorkspaceHostRenderer } from "@ku0/code-application";
import { RuntimeBootstrapEffects } from "../bootstrap/runtimeBootstrap";
import { RuntimePortsProvider } from "../application/runtime/ports";

export const renderCodeWorkspaceHost = createWorkspaceHostRenderer({
  effects: [RuntimeBootstrapEffects],
  providers: [RuntimePortsProvider],
});

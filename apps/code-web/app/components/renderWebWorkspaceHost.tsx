import { BrowserRuntimeBootstrapEffects, createWorkspaceHostRenderer } from "@ku0/code-application";

export const renderWebWorkspaceHost = createWorkspaceHostRenderer({
  effects: [BrowserRuntimeBootstrapEffects],
});

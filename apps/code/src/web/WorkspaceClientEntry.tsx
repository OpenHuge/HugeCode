import { WorkspaceClientBoot } from "@ku0/code-workspace-client/workspace";
import { createDesktopWorkspaceClientBindings } from "./createDesktopWorkspaceClientBindings";

const workspaceClientBindings = createDesktopWorkspaceClientBindings();

export function WorkspaceClientEntry() {
  return <WorkspaceClientBoot bindings={workspaceClientBindings} />;
}

export default WorkspaceClientEntry;

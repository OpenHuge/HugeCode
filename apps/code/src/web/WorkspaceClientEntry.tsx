import { createRuntimeKernel } from "../application/runtime/kernel/createRuntimeKernel";
import { WorkspaceClientBoot } from "@ku0/code-workspace-client";
import { createDesktopWorkspaceClientBindings } from "./createDesktopWorkspaceClientBindings";

const runtimeKernel = createRuntimeKernel();
const workspaceClientBindings = createDesktopWorkspaceClientBindings(runtimeKernel);

export function WorkspaceClientEntry() {
  return <WorkspaceClientBoot bindings={workspaceClientBindings} />;
}

export default WorkspaceClientEntry;

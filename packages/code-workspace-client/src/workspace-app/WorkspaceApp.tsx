import { useWorkspaceClientBindings } from "../workspace/WorkspaceClientBindingsProvider";

export function WorkspaceApp() {
  const bindings = useWorkspaceClientBindings();
  const WorkspaceAppImpl = bindings.platformUi.WorkspaceApp;
  return <WorkspaceAppImpl />;
}

export default WorkspaceApp;

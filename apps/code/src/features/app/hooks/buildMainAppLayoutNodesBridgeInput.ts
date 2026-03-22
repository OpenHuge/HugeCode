import type { UseMainAppLayoutNodesStateParams } from "../types/mainAppLayoutContracts";
import { buildMainAppConversationAndComposerBridgeInput } from "./layoutBridge/buildMainAppConversationAndComposerBridgeInput";
import { buildMainAppLayoutShellBridgeInput } from "./layoutBridge/buildMainAppLayoutShellBridgeInput";
import { buildMainAppRuntimeAndNotificationsBridgeInput } from "./layoutBridge/buildMainAppRuntimeAndNotificationsBridgeInput";
import { useMainAppGitAndReviewBridgeState } from "./layoutBridge/useMainAppGitAndReviewBridgeState";
import { useMainAppLayoutNodesBridge } from "./useMainAppLayoutNodesBridge";

export function useMainAppLayoutNodesState(params: UseMainAppLayoutNodesStateParams) {
  const shellBridgeInput = buildMainAppLayoutShellBridgeInput(params.shell);
  const runtimeBridgeInput = buildMainAppRuntimeAndNotificationsBridgeInput(params.runtime);
  const conversationBridgeInput = buildMainAppConversationAndComposerBridgeInput(
    params.conversation
  );
  const gitReviewBridgeInput = useMainAppGitAndReviewBridgeState(params.gitReview);

  return useMainAppLayoutNodesBridge({
    ...shellBridgeInput,
    ...runtimeBridgeInput,
    ...gitReviewBridgeInput,
    ...conversationBridgeInput,
  });
}

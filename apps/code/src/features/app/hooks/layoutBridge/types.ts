import type { ReviewPackSelectionRequest } from "../../../review/utils/reviewPackSurfaceModel";
import type { UseMainAppLayoutNodesStateParams } from "../../types/mainAppLayoutContracts";
import type { useMainAppLayoutNodesBridge } from "../useMainAppLayoutNodesBridge";

export type MainAppLayoutBridgeParams = Parameters<typeof useMainAppLayoutNodesBridge>[0];

export type MainAppLayoutShellBridgeDomainInput = UseMainAppLayoutNodesStateParams["shell"];
export type MainAppLayoutConversationBridgeDomainInput =
  UseMainAppLayoutNodesStateParams["conversation"];
export type MainAppLayoutGitReviewBridgeDomainInput = UseMainAppLayoutNodesStateParams["gitReview"];
export type MainAppLayoutRuntimeBridgeDomainInput = UseMainAppLayoutNodesStateParams["runtime"];

export type MainAppReviewPackControllerReadyCallback =
  | ((openReviewPack: (request: ReviewPackSelectionRequest) => void) => void)
  | null;

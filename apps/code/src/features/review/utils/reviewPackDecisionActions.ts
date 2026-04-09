import type { MissionNavigationTarget } from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import {
  buildRuntimeReviewPackDecisionActions,
  buildRuntimeReviewPackInterventionDecisionActions,
  type ReviewInterventionAvailability,
  type ReviewPackDecisionState,
  type RuntimeReviewPackDecisionActionModel,
} from "@ku0/code-application/runtimeReviewPackDecisionActionsFacade";

export type ReviewPackDecisionActionModel =
  RuntimeReviewPackDecisionActionModel<MissionNavigationTarget>;

export {
  buildRuntimeReviewPackDecisionActions as buildReviewPackDecisionActions,
  buildRuntimeReviewPackInterventionDecisionActions as buildReviewPackInterventionDecisionActions,
};
export type { ReviewInterventionAvailability, ReviewPackDecisionState };

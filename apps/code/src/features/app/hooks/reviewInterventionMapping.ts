import type { MissionInterventionDraft } from "../../../application/runtime/facades/runtimeTaskInterventionDraftFacade";

export type ReviewInterventionAction =
  | "retry"
  | "continue_with_clarification"
  | "switch_profile_and_retry"
  | "escalate_to_pair_mode";

export function mapInterventionIntentToAction(
  intent: MissionInterventionDraft["intent"]
): ReviewInterventionAction {
  switch (intent) {
    case "retry":
      return "retry";
    case "clarify":
      return "continue_with_clarification";
    case "switch_profile":
      return "switch_profile_and_retry";
    case "pair_mode":
      return "escalate_to_pair_mode";
    default: {
      const exhaustiveCheck: never = intent;
      return exhaustiveCheck;
    }
  }
}

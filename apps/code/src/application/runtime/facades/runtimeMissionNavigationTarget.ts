// TODO(runtime-control-plane): remove this compatibility re-export once app surfaces
// import mission navigation helpers from @ku0/code-application directly.
export {
  buildMissionNavigationTarget,
  buildReviewNavigationTarget,
} from "@ku0/code-application/runtimeMissionNavigationTarget";
export type { MissionNavigationTarget } from "@ku0/code-application/runtimeMissionNavigationTarget";

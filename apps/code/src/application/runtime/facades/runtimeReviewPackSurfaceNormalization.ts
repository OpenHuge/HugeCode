// TODO(runtime-control-plane): remove this compatibility re-export once app surfaces
// import review-pack surface normalization helpers from @ku0/code-application directly.
export {
  normalizeReviewPackPublishHandoff,
  normalizeReviewPackRelaunchOptions,
} from "@ku0/code-application/runtimeReviewPackSurfaceNormalization";
export type {
  NormalizedPublishHandoff,
  NormalizedRelaunchOption,
} from "@ku0/code-application/runtimeReviewPackSurfaceNormalization";

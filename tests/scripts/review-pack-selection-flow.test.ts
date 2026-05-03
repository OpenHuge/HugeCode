import { describe, expect, it } from "vitest";
import {
  buildReviewPackDetailModel,
  resolveReviewPackSelection,
} from "../../packages/code-application/src/runtime-control-plane/reviewPackSurfaceModel";

describe("review-pack selection flow", () => {
  it("keeps the shared review-pack surface empty state stable without an app-local facade", () => {
    const selection = resolveReviewPackSelection({
      projection: null,
      workspaceId: "workspace-1",
      request: {
        workspaceId: "workspace-1",
        reviewPackId: "review-pack-1",
        source: "review_surface",
      },
    });

    expect(selection).toMatchObject({
      status: "empty",
      detailKind: "none",
      selectedWorkspaceId: "workspace-1",
      selectedReviewPackId: null,
      fallbackReason: "no_review_packs",
    });
    expect(
      buildReviewPackDetailModel({
        projection: null,
        selection,
      })
    ).toBeNull();
  });
});

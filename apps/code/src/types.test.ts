import { describe, expectTypeOf, it } from "vitest";
import type { DistributedTaskGraphSnapshot } from "./application/runtime/types/distributedTaskGraph";
import type { TurnPlan } from "./types";

describe("types", () => {
  it("keeps turn-plan distributed graphs aligned with the runtime snapshot type", () => {
    expectTypeOf<
      NonNullable<TurnPlan["distributedGraph"]>
    >().toEqualTypeOf<DistributedTaskGraphSnapshot>();
  });
});

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceHomeRuntimePolicyIndicator } from "./WorkspaceHomeRuntimePolicyIndicator";

afterEach(() => {
  cleanup();
});

describe("WorkspaceHomeRuntimePolicyIndicator browser styles", () => {
  it("renders policy capability cards with runtime-owned status chrome", () => {
    render(
      <WorkspaceHomeRuntimePolicyIndicator
        policy={{
          readiness: "attention",
          statusLabel: "Attention",
          statusTone: "warning",
          headline: "Governance / Policy is actively constraining runtime behavior",
          summary: "Runtime policy is active in Strict mode with 2 operator-visible constraints.",
          mode: "Strict",
          updatedAt: 1_700_000_000_000,
          activeConstraintCount: 2,
          blockedCapabilityCount: 1,
          error: null,
          capabilities: [
            {
              capabilityId: "tool_preflight",
              label: "Tool preflight",
              readiness: "attention",
              effect: "approval",
              activeConstraint: true,
              effectLabel: "Approval gated",
              summary: "Strict mode gates medium and high-risk actions.",
              detail: "Operator approval is required before risky tool execution can continue.",
            },
          ],
        }}
      />
    );

    const policySurface = document.querySelector<HTMLElement>(
      '[data-testid="workspace-runtime-policy"]'
    );
    if (!policySurface) {
      throw new Error("Expected runtime policy surface");
    }

    const capabilityCard = policySurface.querySelector<HTMLElement>("div[class]");
    if (!capabilityCard) {
      throw new Error("Expected policy capability card");
    }

    const cardStyle = window.getComputedStyle(capabilityCard);
    expect(cardStyle.borderRadius).not.toBe("");
    expect(policySurface.textContent).toContain("Policy mode: Strict");
    expect(policySurface.textContent).toContain("Tool preflight");
    expect(policySurface.textContent).toContain("Approval gated");
  });
});

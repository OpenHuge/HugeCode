/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComposerPendingFooterActions } from "./ComposerPendingStateChrome";

afterEach(() => {
  cleanup();
});

describe("ComposerPendingStateChrome", () => {
  it("keeps pending user-input footer actions interactive through the app design-system button adapter", () => {
    const onPendingPrevious = vi.fn();
    const onPendingAdvance = vi.fn();

    render(
      <ComposerPendingFooterActions
        pendingUserInputActive
        activePendingQuestion={{
          id: "approval_mode",
          header: "Mode",
          question: "Choose a mode",
          options: [
            { label: "Safe", description: "Safer route." },
            { label: "Fast", description: "Faster route." },
          ],
        }}
        pendingUserInputRequestIndex={1}
        pendingUserInputRequestCount={1}
        pendingQuestionIndex={1}
        pendingQuestions={[
          {
            id: "approval_mode",
            header: "Mode",
            question: "Choose a mode",
            options: [
              { label: "Safe", description: "Safer route." },
              { label: "Fast", description: "Faster route." },
            ],
          },
          {
            id: "confirm",
            header: "Confirm",
            question: "Confirm the choice",
            options: [{ label: "Yes", description: "Continue." }],
          },
        ]}
        activePendingSelectedIndex={0}
        onSelectPendingOption={vi.fn()}
        onPendingPrevious={onPendingPrevious}
        onPendingAdvance={onPendingAdvance}
        pendingApprovalActive={false}
        pendingApprovalRequest={null}
        pendingApprovalCommandTokens={null}
        pendingToolCallActive={false}
        pendingToolCallRequest={null}
        pendingToolCallOutput=""
        pendingToolCallSuccess
        onPendingToolCallOutputChange={vi.fn()}
        onPendingToolCallSuccessChange={vi.fn()}
        onPendingToolCallSubmit={vi.fn()}
        pendingPlanReviewActive={false}
        pendingPlanFollowup={null}
        pendingPlanChanges=""
        onPendingPlanChangesChange={vi.fn()}
        onPendingPlanAccept={vi.fn()}
        onPendingPlanSubmitChanges={vi.fn()}
      />
    );

    const previousButton = screen.getByRole("button", { name: "Previous" });
    const submitButton = screen.getByRole("button", { name: "Submit answers" });

    expect((previousButton as HTMLButtonElement).type).toBe("button");
    expect((submitButton as HTMLButtonElement).type).toBe("button");

    fireEvent.click(previousButton);
    fireEvent.click(submitButton);

    expect(onPendingPrevious).toHaveBeenCalledTimes(1);
    expect(onPendingAdvance).toHaveBeenCalledTimes(1);
  });

  it("keeps resolver panels on flatter shells instead of gradient promo surfaces", () => {
    const resolverSource = readFileSync(
      resolve(import.meta.dirname, "ComposerResolverPanel.css.ts"),
      "utf8"
    );
    const approvalSource = readFileSync(
      resolve(import.meta.dirname, "ComposerApprovalPanel.css.ts"),
      "utf8"
    );
    const planSource = readFileSync(
      resolve(import.meta.dirname, "ComposerPlanFollowupPanel.css.ts"),
      "utf8"
    );
    const pendingInputSource = readFileSync(
      resolve(import.meta.dirname, "ComposerPendingUserInputPanel.css.ts"),
      "utf8"
    );

    expect(resolverSource).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-1) 92%), color-mix(in srgb, var(--color-surface-0) 96%, transparent))"
    );
    expect(approvalSource).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--color-surface-1) 72%, transparent), color-mix(in srgb, var(--color-surface-0) 92%, transparent))"
    );
    expect(planSource).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--color-surface-2) 82%, transparent), color-mix(in srgb, var(--color-surface-1) 78%, transparent))"
    );
    expect(resolverSource).not.toContain(
      '"inset 0 -1px 0 color-mix(in srgb, var(--color-border) 30%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 4%, transparent)"'
    );
    expect(pendingInputSource).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 13%, transparent), color-mix(in srgb, var(--color-surface-1) 92%, transparent))"
    );
    expect(pendingInputSource).not.toContain(
      'boxShadow: "0 0 0 1px color-mix(in srgb, var(--color-primary) 16%, transparent)"'
    );
    expect(pendingInputSource).not.toContain('borderRadius: "18px"');
  });
});

/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readRelativeSource } from "../../../test/styleSource";
import { ActivityLogRow } from "./ActivityLogRow";
import { ExecutionStatusPill } from "./ExecutionStatusPill";
import { ToolCallChip } from "./ToolCallChip";

describe("ExecutionPrimitives", () => {
  it("renders activity rows with status and action grammar", () => {
    const { container } = render(
      <ActivityLogRow
        title="Run command"
        description="Execute the runtime probe"
        meta={<ExecutionStatusPill tone="success">Complete</ExecutionStatusPill>}
        actions={<ToolCallChip tone="neutral">shell</ToolCallChip>}
        body="No follow-up required"
        footer="Completed in 2s"
        interactive
        selected
      />
    );

    expect(screen.getByText("Run command")).toBeTruthy();
    expect(screen.getByText("Execute the runtime probe")).toBeTruthy();
    expect(screen.getByText("Complete")).toBeTruthy();
    expect(screen.getByText("shell")).toBeTruthy();
    expect(screen.getByText("No follow-up required")).toBeTruthy();
    expect(screen.getByText("Completed in 2s")).toBeTruthy();
    expect(container.firstElementChild?.getAttribute("aria-disabled")).toBeNull();
  });

  it("keeps the execution chip and pill tone classes app-owned", () => {
    const { container } = render(
      <>
        <ExecutionStatusPill tone="warning" showDot className="custom-pill">
          Review ready
        </ExecutionStatusPill>
        <ToolCallChip tone="success" className="custom-chip" icon={<span>!</span>}>
          apply_patch
        </ToolCallChip>
      </>
    );

    expect(screen.getByText("Review ready").className).toContain("custom-pill");
    expect(screen.getByText("apply_patch").parentElement?.className).toContain("custom-chip");
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(screen.getByText("apply_patch").previousElementSibling?.textContent).toBe("!");
  });

  it("gives execution row icons tone-owned surfaces instead of a single neutral wash", () => {
    const source = readRelativeSource(import.meta.dirname, "./ExecutionPrimitives.css.ts");

    expect(source).toContain("accentIconSurfaceVar");
    expect(source).toContain("accentIconBorderVar");
    expect(source).toContain("accentIconShadowVar");
    expect(source).toContain("radial-gradient(circle at 32% 28%");
    expect(source).toContain("background: accentIconSurfaceVar");
    expect(source).toContain("boxShadow: accentIconShadowVar");
  });
});

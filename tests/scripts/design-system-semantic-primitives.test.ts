import { describe, expect, it } from "vitest";

import {
  elevationValues,
  focusRingValues,
  motionValues,
  overlayValues,
  rowValues,
  statusChipValues,
  typographyValues,
} from "../../packages/design-system/src/semanticPrimitives";

describe("design-system semantic primitives", () => {
  it("exports semantic typography tokens", () => {
    expect(typographyValues.chrome.fontSize).toBe("var(--font-size-chrome)");
    expect(typographyValues.fine.fontSize).toBe("var(--font-size-fine)");
    expect(typographyValues.content.lineHeight).toBe("var(--line-height-content)");
  });

  it("exports semantic motion tokens", () => {
    expect(motionValues.interactive).toContain("var(--duration-fast)");
    expect(motionValues.enter).toContain("var(--duration-normal)");
    expect(motionValues.exit).toContain("var(--ease-smooth)");
  });

  it("exports semantic elevation and focus ring tokens", () => {
    expect(elevationValues.card).toBe("var(--elevation-card)");
    expect(elevationValues.overlay).toBe("var(--elevation-overlay)");
    expect(focusRingValues.button).toBe("var(--focus-ring-button)");
    expect(focusRingValues.input).toBe("var(--focus-ring-input)");
  });

  it("exports row, status-chip, and overlay tokens", () => {
    expect(rowValues.listGap).toBe("var(--spacing-2)");
    expect(statusChipValues.lineHeight).toBe("var(--line-height-chrome)");
    expect(overlayValues.scrim).toBe("var(--color-overlay)");
  });
});

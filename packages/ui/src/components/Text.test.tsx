// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Text } from "../index";

describe("Text", () => {
  it("keeps semantic text primitives consumable through @ku0/ui", () => {
    render(
      <Text size="meta" tone="muted" weight="semibold">
        Review ready
      </Text>
    );

    const text = screen.getByText("Review ready");
    expect(text.getAttribute("data-size")).toBe("meta");
    expect(text.getAttribute("data-tone")).toBe("muted");
    expect(text.getAttribute("data-weight")).toBe("semibold");
  });
});

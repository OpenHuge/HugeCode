import { render } from "@testing-library/react";
import { page, userEvent } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../../design-system";

describe("Vitest Browser Mode smoke", () => {
  it("drives a design-system button through real browser input", async () => {
    const onClick = vi.fn();

    render(
      <Button type="button" onClick={onClick}>
        Browser Mode Smoke
      </Button>
    );

    const button = page.getByRole("button", { name: "Browser Mode Smoke" });

    await expect.element(button).toBeVisible();
    await expect.element(button).toHaveTextContent("Browser Mode Smoke");

    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });
});

import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";
import { ComposerSelectFixture } from "./ComposerSelectFixture";

async function click(element: Element) {
  await act(async () => {
    await userEvent.click(element);
  });
}

afterEach(() => {
  cleanup();
});

describe("ComposerSelectFixture browser styles", () => {
  it("keeps composer select chrome flat while preserving option switching", async () => {
    render(<ComposerSelectFixture />);

    const wrap = document.querySelector<HTMLElement>(".composer-select-wrap--model-provider");
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Model"]');
    if (!wrap || !trigger) {
      throw new Error("Expected composer model select controls");
    }

    const wrapStyle = window.getComputedStyle(wrap);
    const triggerStyle = window.getComputedStyle(trigger);

    expect(wrapStyle.boxShadow).toBe("none");
    expect(triggerStyle.boxShadow).toBe("none");
    expect(triggerStyle.backgroundImage).toBe("none");
    expect(triggerStyle.backdropFilter).toBe("none");

    await click(trigger);

    const providerMenu = screen.getByRole("menu", { name: "Model providers" });
    const menu = screen.getByRole("menu", { name: "Codex models" });
    const selectedOption = within(menu).getByRole("menuitemradio", { name: "GPT-5.4" });
    if (!selectedOption) {
      throw new Error("Expected selected composer model option");
    }

    const menuStyle = window.getComputedStyle(menu);
    const selectedOptionStyle = window.getComputedStyle(selectedOption);

    expect(menuStyle.backgroundImage).toBe("none");
    expect(selectedOptionStyle.backgroundImage).toBe("none");

    await click(within(providerMenu).getByRole("menuitem", { name: "Claude" }));

    const claudeMenu = screen.getByRole("menu", { name: "Claude models" });
    const nextOption = within(claudeMenu).getByRole("menuitemradio", { name: "Claude Sonnet 4.5" });

    await click(nextOption);

    await waitFor(() => {
      const modelTrigger = screen.getByRole("button", { name: "Model" });
      const triggerLabel = modelTrigger.querySelector<HTMLElement>('[class*="triggerLabel"]');
      expect(triggerLabel?.textContent?.trim()).toBe("Claude Sonnet 4.5");
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });
  });
});

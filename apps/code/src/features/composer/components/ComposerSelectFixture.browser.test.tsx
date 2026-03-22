import { act, cleanup, render, waitFor } from "@testing-library/react";
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

    const wrap = document.querySelector<HTMLElement>(".composer-select-wrap--model");
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

    const menu = document.querySelector<HTMLElement>('[role="listbox"][aria-label="Model"]');
    if (!menu) {
      throw new Error("Expected composer model menu");
    }
    const selectedOption = menu.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    if (!selectedOption) {
      throw new Error("Expected selected composer model option");
    }

    const menuStyle = window.getComputedStyle(menu);
    const selectedOptionStyle = window.getComputedStyle(selectedOption);

    expect(menuStyle.backgroundImage).toBe("none");
    expect(selectedOptionStyle.backgroundImage).toBe("none");

    const nextOption = Array.from(menu.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (option) => option.textContent?.trim() === "GPT-5.4 Mini"
    );
    if (!nextOption) {
      throw new Error("Expected GPT-5.4 Mini option");
    }

    await click(nextOption);

    await waitFor(() => {
      expect(trigger.textContent?.trim()).toBe("GPT-5.4 Mini");
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });
  });
});

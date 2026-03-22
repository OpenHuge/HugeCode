import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

afterEach(() => {
  cleanup();
});

describe("Markdown skill reference browser styles", () => {
  it("keeps skill references on flat inline chrome and flat tooltip cards", async () => {
    render(
      <Markdown
        value="Use $Using Superpowers before editing."
        skills={[
          {
            name: "Using Superpowers",
            path: "/Users/han/.codex/superpowers/skills/using-superpowers/SKILL.md",
            description:
              "Use when starting any conversation - establishes how to find and use skills.",
            scope: "global",
            sourceFamily: "codex",
          },
        ]}
      />
    );

    const trigger = document.querySelector<HTMLElement>(".message-skill-link");
    if (!trigger) {
      throw new Error("Expected skill reference trigger");
    }

    const triggerStyle = window.getComputedStyle(trigger);
    expect(triggerStyle.backgroundImage).toBe("none");
    expect(triggerStyle.boxShadow).toBe("none");

    await act(async () => {
      fireEvent.mouseEnter(trigger);
    });

    await waitFor(() => {
      expect(document.querySelector<HTMLElement>(".message-skill-tooltip-content")).not.toBeNull();
    });

    const tooltip = document.querySelector<HTMLElement>(".message-skill-tooltip-content");
    if (!tooltip) {
      throw new Error("Expected skill reference tooltip");
    }

    const tooltipStyle = window.getComputedStyle(tooltip);
    expect(tooltipStyle.backgroundImage).toBe("none");
    expect(tooltipStyle.boxShadow).toBe("none");
  });
});

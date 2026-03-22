// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readRelativeSource } from "../../../test/styleSource";
import { ComposerToolCallRequestPanel } from "./ComposerToolCallRequestPanel";

describe("ComposerToolCallRequestPanel", () => {
  it("exposes the success toggle with a focused label and separate description", () => {
    const onOutputChange = vi.fn();
    const onSuccessChange = vi.fn();

    render(
      <ComposerToolCallRequestPanel
        toolName="web.search"
        callId="call-1"
        argumentsValue={{ q: "token pipeline" }}
        outputText="initial output"
        success
        onOutputChange={onOutputChange}
        onSuccessChange={onSuccessChange}
      />
    );

    const output = screen.getByRole("textbox", { name: "Tool call output" });
    const successToggle = screen.getByRole("checkbox", { name: "Mark call successful" });

    expect(output).toBeTruthy();
    expect((output as HTMLTextAreaElement).value).toBe("initial output");
    expect((successToggle as HTMLInputElement).checked).toBe(true);

    const describedBy = successToggle.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(
      screen.getByText("Uncheck this if the tool failed or should return an error outcome.")
    ).toBeTruthy();

    fireEvent.click(successToggle);
    expect(onSuccessChange).toHaveBeenCalledWith(false);
  });

  it("keeps tool-call detail cards on muted surfaces instead of elevated promo cards", () => {
    const source = readRelativeSource(import.meta.dirname, "ComposerToolCallRequestPanel.css.ts");

    expect(source).not.toContain(
      'background: "color-mix(in srgb, var(--color-surface-1) 88%, transparent)"'
    );
    expect(source).not.toContain(
      'background: "color-mix(in srgb, var(--color-surface-1) 82%, transparent)"'
    );
    expect(source).not.toContain('borderRadius: "16px"');
    expect(source).not.toContain(
      'background: "color-mix(in srgb, var(--color-surface-0) 96%, transparent)"'
    );
  });
});

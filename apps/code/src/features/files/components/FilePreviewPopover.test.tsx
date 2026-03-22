/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilePreviewPopover } from "./FilePreviewPopover";

afterEach(() => {
  cleanup();
});

describe("FilePreviewPopover", () => {
  it("uses non-submit preview action buttons and preserves add/close behavior", () => {
    const onAddSelection = vi.fn();
    const onClose = vi.fn();

    render(
      <FilePreviewPopover
        path="src/example.ts"
        absolutePath="/tmp/src/example.ts"
        content={"const value = 1;\nconsole.log(value);"}
        truncated={false}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        selection={{ start: 0, end: 1 }}
        onSelectLine={vi.fn()}
        onClearSelection={vi.fn()}
        onAddSelection={onAddSelection}
        onClose={onClose}
        anchorTop={0}
        anchorLeft={0}
        arrowTop={0}
      />
    );

    const closeButton = screen.getByRole("button", { name: "Close preview" });
    const addButton = screen.getByRole("button", { name: "Add to chat" });

    expect((closeButton as HTMLButtonElement).type).toBe("button");
    expect((addButton as HTMLButtonElement).type).toBe("button");

    fireEvent.click(addButton);
    fireEvent.click(closeButton);

    expect(onAddSelection).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

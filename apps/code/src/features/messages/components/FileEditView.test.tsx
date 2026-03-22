// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileEditView } from "./FileEditView";

const clipboardWriteTextMock = vi.fn<(value: string) => Promise<void>>();

describe("FileEditView", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    clipboardWriteTextMock.mockReset();
    clipboardWriteTextMock.mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteTextMock },
    });
  });

  it("renders file header and diff stats", () => {
    render(
      <FileEditView
        change={{
          path: "src/hooks/useMainAppHomeState.test.tsx",
          kind: "edit",
          diff: [
            "@@ -32,5 +32,6 @@",
            " function createParams(",
            "-  overrides: {}",
            "+  overrides: {",
            "+    activeThreadId?: string | null;",
            " }",
          ].join("\n"),
        }}
      />
    );

    expect(screen.getByText("Edited file")).toBeTruthy();
    expect(screen.getByText("EDIT")).toBeTruthy();
    expect(screen.getByText("useMainAppHomeState.test.tsx")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.getByText("-1")).toBeTruthy();
    expect(screen.getByText("src/hooks/useMainAppHomeState.test.tsx")).toBeTruthy();
  });

  it("copies the file path", async () => {
    render(
      <FileEditView
        change={{
          path: "src/features/messages/components/FileEditView.tsx",
          diff: "@@ -1 +1 @@\n-foo\n+bar",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy file path" }));

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(
        "src/features/messages/components/FileEditView.tsx"
      );
    });
    expect(screen.getByRole("button", { name: "Copied file path" })).toBeTruthy();
  });

  it("shows an empty state when no diff is provided", () => {
    render(
      <FileEditView
        change={{
          path: "src/features/messages/components/MessageRows.tsx",
          kind: "edit",
        }}
      />
    );

    expect(screen.getByText("No inline diff provided.")).toBeTruthy();
  });
});

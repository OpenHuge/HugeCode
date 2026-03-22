// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getIconUrlForFilePath = vi.fn((path: string, baseUrl: string) => `${baseUrl}/${path}.svg`);

vi.mock("vscode-material-icons", () => ({
  getIconUrlForFilePath,
}));

describe("FileTypeIconImage", () => {
  afterEach(async () => {
    cleanup();
    vi.clearAllMocks();
    const fileTypeIcons = await import("../../../utils/fileTypeIcons");
    fileTypeIcons.resetFileTypeIconCacheForTests();
  });

  it("renders the fallback first and swaps to the resolved icon", async () => {
    const { FileTypeIconImage } = await import("./FileTypeIconImage");
    const view = render(
      <FileTypeIconImage
        path="src/App.tsx"
        alt=""
        className="test-icon"
        fallback={<span data-testid="fallback">fallback</span>}
      />
    );

    expect(view.getByTestId("fallback")).toBeTruthy();
    expect(view.container.querySelector("img")).toBeNull();

    await waitFor(() => {
      expect(view.container.querySelector("img")?.getAttribute("src")).toBe(
        "/assets/material-icons/src/App.tsx.svg"
      );
    });
  });

  it("reuses cached icon urls on later renders", async () => {
    const fileTypeIcons = await import("../../../utils/fileTypeIcons");
    await fileTypeIcons.preloadFileTypeIconUrl("src/App.tsx");

    const { FileTypeIconImage } = await import("./FileTypeIconImage");
    const view = render(
      <FileTypeIconImage
        path="src/App.tsx"
        alt=""
        className="test-icon"
        fallback={<span data-testid="fallback">fallback</span>}
      />
    );

    expect(view.queryByTestId("fallback")).toBeNull();
    expect(view.container.querySelector("img")?.getAttribute("src")).toBe(
      "/assets/material-icons/src/App.tsx.svg"
    );
    expect(getIconUrlForFilePath).toHaveBeenCalledTimes(1);
  });
});

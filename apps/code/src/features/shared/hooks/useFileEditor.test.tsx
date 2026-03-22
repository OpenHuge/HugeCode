// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFileEditor } from "./useFileEditor";

const baseResponse = (content: string) => ({
  exists: true,
  content,
  truncated: false,
});

describe("useFileEditor", () => {
  it("does not auto-refresh when key is unchanged and read callback identity changes", async () => {
    const firstRead = vi.fn().mockResolvedValue(baseResponse("one"));
    const secondRead = vi.fn().mockResolvedValue(baseResponse("two"));
    const write = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ read }) =>
        useFileEditor({
          key: "global-agents",
          read,
          write,
          readErrorTitle: "Read failed",
          writeErrorTitle: "Write failed",
        }),
      {
        initialProps: {
          read: firstRead,
        },
      }
    );

    await waitFor(() => {
      expect(result.current.content).toBe("one");
      expect(result.current.isLoading).toBe(false);
    });
    expect(firstRead).toHaveBeenCalledTimes(1);

    rerender({ read: secondRead });
    await act(async () => {
      await Promise.resolve();
    });

    expect(firstRead).toHaveBeenCalledTimes(1);
    expect(secondRead).toHaveBeenCalledTimes(0);
    expect(result.current.content).toBe("one");
  });

  it("uses latest read callback for manual refresh with unchanged key", async () => {
    const firstRead = vi.fn().mockResolvedValue(baseResponse("one"));
    const secondRead = vi.fn().mockResolvedValue(baseResponse("two"));
    const write = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ read }) =>
        useFileEditor({
          key: "global-agents",
          read,
          write,
          readErrorTitle: "Read failed",
          writeErrorTitle: "Write failed",
        }),
      {
        initialProps: {
          read: firstRead,
        },
      }
    );

    await waitFor(() => {
      expect(result.current.content).toBe("one");
    });

    rerender({ read: secondRead });

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.content).toBe("two");
    });
    expect(secondRead).toHaveBeenCalledTimes(1);
  });
});

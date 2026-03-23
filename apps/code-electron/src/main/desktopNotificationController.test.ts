import { describe, expect, it, vi } from "vitest";
import { createDesktopNotificationController } from "./desktopNotificationController.js";

describe("desktopNotificationController", () => {
  it("returns false when notifications are not supported", () => {
    const controller = createDesktopNotificationController({
      browserWindow: {
        fromWebContents: vi.fn(() => null),
      },
      notification: {
        create: vi.fn(),
        isSupported: vi.fn(() => false),
      },
    });

    expect(
      controller.showNotification(
        { sender: { id: "renderer" } },
        {
          title: "Build finished",
        }
      )
    ).toBe(false);
  });

  it("shows a notification and focuses the source window on click", () => {
    const show = vi.fn();
    let clickListener: (() => void) | null = null;
    const on = vi.fn((event: string, listener: () => void) => {
      if (event === "click") {
        clickListener = listener;
      }
    });
    const sourceWindow = {
      focus: vi.fn(),
      isDestroyed: vi.fn(() => false),
      show: vi.fn(),
    };
    const controller = createDesktopNotificationController({
      browserWindow: {
        fromWebContents: vi.fn(() => sourceWindow),
      },
      notification: {
        create: vi.fn(() => ({
          on,
          show,
        })),
        isSupported: vi.fn(() => true),
      },
    });

    expect(
      controller.showNotification(
        { sender: { id: "renderer" } },
        {
          body: "Renderer bundle is ready.",
          title: "Build finished",
        }
      )
    ).toBe(true);

    expect(show).toHaveBeenCalledTimes(1);
    expect(clickListener).toBeTypeOf("function");
    clickListener?.();
    expect(sourceWindow.show).toHaveBeenCalledTimes(1);
    expect(sourceWindow.focus).toHaveBeenCalledTimes(1);
  });
});

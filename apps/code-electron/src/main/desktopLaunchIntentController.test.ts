import { describe, expect, it, vi } from "vitest";
import { createDesktopLaunchIntentController } from "./desktopLaunchIntentController.js";

describe("desktopLaunchIntentController", () => {
  it("captures protocol launch intents from initial argv and consumes them once", () => {
    const controller = createDesktopLaunchIntentController({
      app: {
        on: vi.fn(),
        setAsDefaultProtocolClient: vi.fn(() => true),
      },
      initialArgv: [
        "/Applications/HugeCode.app/Contents/MacOS/HugeCode",
        "hugecode://workspace/open?path=%2Fworkspace%2Falpha",
      ],
      platform: "darwin",
      protocol: "hugecode",
    });

    controller.registerProtocolClient();

    expect(controller.consumePendingIntent()).toMatchObject({
      kind: "protocol",
      url: "hugecode://workspace/open?path=%2Fworkspace%2Falpha",
    });
    expect(controller.consumePendingIntent()).toBeNull();
  });

  it("registers open-url handling on macOS and ignores unrelated protocols", () => {
    let openUrlListener: ((event: { preventDefault(): void }, url: string) => void) | undefined;

    const app = {
      on: vi.fn(
        (event: string, listener: (event: { preventDefault(): void }, url: string) => void) => {
          if (event === "open-url") {
            openUrlListener = listener;
          }
        }
      ),
      setAsDefaultProtocolClient: vi.fn(() => true),
    };

    const controller = createDesktopLaunchIntentController({
      app,
      platform: "darwin",
      protocol: "hugecode",
    });

    controller.registerAppHandlers();

    const preventDefault = vi.fn();
    openUrlListener?.({ preventDefault }, "mailto:test@example.com");
    expect(controller.consumePendingIntent()).toBeNull();

    openUrlListener?.({ preventDefault }, "hugecode://workspace/open?path=%2Fworkspace%2Fbeta");
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(controller.consumePendingIntent()).toMatchObject({
      kind: "protocol",
    });
  });
});

import type { DesktopSessionDescriptor, DesktopWindowDescriptor } from "./desktopShellState.js";

type DesktopIncidentLogger = Pick<Console, "info" | "warn">;

type DesktopNotificationControllerLike = {
  showDesktopNotification(
    input: {
      body?: string | null;
      title: string;
    },
    options?: {
      onClick?: () => void;
    }
  ): boolean;
};

export type CreateDesktopResilienceControllerInput = {
  isQuitting(): boolean;
  logger?: DesktopIncidentLogger;
  notificationController: DesktopNotificationControllerLike;
  recoverWindow(windowId: number): DesktopWindowDescriptor | null;
};

function describeSession(session: DesktopSessionDescriptor | null) {
  return session?.workspaceLabel ?? session?.workspacePath ?? "this window";
}

export function createDesktopResilienceController(input: CreateDesktopResilienceControllerInput) {
  const logger = input.logger ?? {
    info() {},
    warn() {},
  };
  const unresponsiveWindowIds = new Set<number>();

  return {
    handleChildProcessGone(details: {
      exitCode: number;
      name?: string;
      reason: string;
      serviceName?: string;
      type: string;
    }) {
      logger.warn("HugeCode desktop child process exited unexpectedly.", {
        event: "desktop_child_process_gone",
        ...details,
      });
    },
    handleRenderProcessGone(payload: {
      details: { exitCode: number; reason: string };
      session: DesktopSessionDescriptor | null;
      windowId: number;
    }) {
      logger.warn("HugeCode desktop renderer process exited unexpectedly.", {
        event: "desktop_render_process_gone",
        exitCode: payload.details.exitCode,
        reason: payload.details.reason,
        sessionId: payload.session?.id ?? null,
        windowId: payload.windowId,
      });

      if (input.isQuitting()) {
        return null;
      }

      const replacementWindow = input.recoverWindow(payload.windowId);
      if (!replacementWindow) {
        return null;
      }

      input.notificationController.showDesktopNotification(
        {
          body: `HugeCode recovered ${describeSession(payload.session)} after a renderer failure (${payload.details.reason}).`,
          title: "HugeCode Recovered a Window",
        },
        {
          onClick: () => {
            input.recoverWindow(replacementWindow.windowId);
          },
        }
      );

      return replacementWindow;
    },
    handleWindowResponsive(payload: {
      session: DesktopSessionDescriptor | null;
      windowId: number;
    }) {
      if (!unresponsiveWindowIds.delete(payload.windowId)) {
        return;
      }

      logger.info("HugeCode desktop window responsiveness recovered.", {
        event: "desktop_window_responsive",
        sessionId: payload.session?.id ?? null,
        windowId: payload.windowId,
      });
    },
    handleWindowUnresponsive(payload: {
      focusWindow(): boolean;
      session: DesktopSessionDescriptor | null;
      windowId: number;
    }) {
      if (unresponsiveWindowIds.has(payload.windowId)) {
        return false;
      }

      unresponsiveWindowIds.add(payload.windowId);
      logger.warn("HugeCode desktop window became unresponsive.", {
        event: "desktop_window_unresponsive",
        sessionId: payload.session?.id ?? null,
        windowId: payload.windowId,
      });
      return input.notificationController.showDesktopNotification(
        {
          body: `HugeCode detected that ${describeSession(payload.session)} is not responding. Click to focus the window and wait for recovery.`,
          title: "HugeCode Window Not Responding",
        },
        {
          onClick: () => {
            payload.focusWindow();
          },
        }
      );
    },
  };
}

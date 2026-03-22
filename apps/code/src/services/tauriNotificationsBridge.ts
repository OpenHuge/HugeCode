import { invoke } from "@tauri-apps/api/core";
import type { Options as NotificationOptions } from "@tauri-apps/plugin-notification";
import { logRuntimeWarning } from "./tauriRuntimeTurnHelpers";

export async function sendNotification(
  title: string,
  body: string,
  options?: {
    id?: number;
    group?: string;
    actionTypeId?: string;
    sound?: string;
    autoCancel?: boolean;
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  const macosDebugBuild = await invoke<boolean>("is_macos_debug_build").catch(() => false);
  const attemptFallback = async () => {
    try {
      await invoke("send_notification_fallback", { title, body });
      return true;
    } catch (error) {
      logRuntimeWarning("Notification fallback failed.", { error });
      return false;
    }
  };

  // In dev builds on macOS, the notification plugin can silently fail because
  // the process is not a bundled app. Prefer the native AppleScript fallback.
  if (macosDebugBuild) {
    await attemptFallback();
    return;
  }

  try {
    const notification = await import("@tauri-apps/plugin-notification");
    let permissionGranted = await notification.isPermissionGranted();
    if (!permissionGranted) {
      const permission = await notification.requestPermission();
      permissionGranted = permission === "granted";
      if (!permissionGranted) {
        logRuntimeWarning("Notification permission not granted.", { permission });
        await attemptFallback();
        return;
      }
    }
    if (permissionGranted) {
      const payload: NotificationOptions = { title, body };
      if (options?.id !== undefined) {
        payload.id = options.id;
      }
      if (options?.group !== undefined) {
        payload.group = options.group;
      }
      if (options?.actionTypeId !== undefined) {
        payload.actionTypeId = options.actionTypeId;
      }
      if (options?.sound !== undefined) {
        payload.sound = options.sound;
      }
      if (options?.autoCancel !== undefined) {
        payload.autoCancel = options.autoCancel;
      }
      if (options?.extra !== undefined) {
        payload.extra = options.extra;
      }
      await notification.sendNotification(payload);
      return;
    }
  } catch (error) {
    logRuntimeWarning("Notification plugin failed.", { error });
  }

  await attemptFallback();
}

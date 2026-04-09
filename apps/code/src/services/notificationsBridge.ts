import {
  isPermissionGranted,
  requestPermission,
  sendNotification as sendDesktopNotification,
} from "@tauri-apps/plugin-notification";
import { invoke } from "../application/runtime/ports/desktopHostCore";
import { getDesktopHostBridge } from "../application/runtime/ports/desktopHostBridge";
import { logRuntimeWarning } from "./runtimeTurnHelpers";

type DesktopNotificationOptions = {
  id?: number;
  group?: string;
  actionTypeId?: string;
  sound?: string;
  autoCancel?: boolean;
  extra?: Record<string, unknown>;
};

async function sendFallbackNotification(
  title: string,
  body: string,
  options?: DesktopNotificationOptions
) {
  try {
    await invoke("send_notification_fallback", {
      title,
      body,
      ...(options?.extra ? { extra: options.extra } : {}),
    });
  } catch (error) {
    logRuntimeWarning("Notification fallback delivery failed.", { error });
  }
}

export async function sendNotification(
  title: string,
  body: string,
  options?: DesktopNotificationOptions
): Promise<void> {
  const shown = await getDesktopHostBridge()?.notifications?.show?.({
    body,
    title,
  });
  if (shown !== false && shown !== undefined) {
    return;
  }

  try {
    const isMacOsDebugBuild = await invoke<boolean>("is_macos_debug_build");
    if (isMacOsDebugBuild) {
      await sendFallbackNotification(title, body, options);
      return;
    }
  } catch {
    // Continue with plugin/browser fallback flow.
  }

  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      permissionGranted = (await requestPermission()) === "granted";
    }
    if (!permissionGranted) {
      logRuntimeWarning("Notification permission not granted.", { permission: "denied" });
      await sendFallbackNotification(title, body, options);
      return;
    }
    await sendDesktopNotification({
      title,
      body,
      ...(options?.extra ? { extra: options.extra } : {}),
    });
    return;
  } catch (error) {
    logRuntimeWarning("Notification delivery failed.", { error });
    await sendFallbackNotification(title, body, options);
  }

  if (typeof Notification !== "function") {
    return;
  }

  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      logRuntimeWarning("Notification permission not granted.", { permission });
      return;
    }

    const notification = new Notification(title, {
      body,
      tag: options?.group,
    });
    if (options?.autoCancel !== false) {
      notification.onshow = () => {
        setTimeout(() => {
          notification.close();
        }, 8_000);
      };
    }
  } catch (error) {
    logRuntimeWarning("Notification delivery failed.", { error });
  }
}
